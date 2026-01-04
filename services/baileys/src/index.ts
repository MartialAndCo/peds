import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WAMessage,
    downloadMediaMessage
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import fastify from 'fastify'
import { pino } from 'pino'
// import pino from 'pino' // TS often hates default import in ESM
import qrcode from 'qrcode-terminal'
import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'
import { createRequire } from 'module' // fix for simple-to-import modules

dotenv.config()

// ESM/CJS interop fix key: Remove require hacks that fail in Docker
// const require = createRequire(import.meta.url) // REMOVED
// const { makeInMemoryStore } = require('@whiskeysockets/baileys') // REMOVED

const PORT = 3001
const WEBHOOK_URL = process.env.WEBHOOK_URL
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
const AUTH_TOKEN = process.env.AUTH_TOKEN

if (!AUTH_TOKEN) {
    console.error('FATAL: AUTH_TOKEN is not defined in environment variables. Exiting for security.')
    process.exit(1)
}

if (!WEBHOOK_SECRET) {
    console.warn('WARNING: WEBHOOK_SECRET is not defined. Webhook calls will likely fail authentication.')
}

// --- CUSTOM STORE IMPLEMENTATION ---
// Replaces makeInMemoryStore to enable message retries without import issues
function makeSimpleStore() {
    // remoteJid -> Array of WAMessage
    const messages = new Map<string, any[]>()

    return {
        messages, // Expose for debugging if needed
        bind(ev: any) {
            ev.on('messages.upsert', (data: any) => {
                const { messages: msgs, type } = data
                for (const m of msgs) {
                    const jid = m.key.remoteJid
                    if (!jid) continue
                    const list = messages.get(jid) || []

                    // If update, find and replace? For now, just append/manage simple history
                    // Simple history: Keep last 200 messages per chat
                    const existingIdx = list.findIndex((ex: any) => ex.key.id === m.key.id)
                    if (existingIdx > -1) {
                        list[existingIdx] = m
                    } else {
                        list.push(m)
                    }

                    // Trim
                    if (list.length > 200) {
                        list.splice(0, list.length - 200)
                    }

                    messages.set(jid, list)
                }
            })
        },
        async loadMessage(jid: string, id: string) {
            const list = messages.get(jid)
            if (!list || list.length === 0) return undefined
            const found = list.find((m: any) => m.key.id === id)
            return found // return the full message object
        },
        readFromFile(path: string) {
            if (fs.existsSync(path)) {
                try {
                    const data = JSON.parse(fs.readFileSync(path, 'utf-8'))
                    // Correctly rehydrate Map
                    for (const jid in data) {
                        messages.set(jid, data[jid])
                    }
                    console.log(`[Store] Loaded ${messages.size} chats from disk`)
                } catch (e) {
                    console.error('[Store] Failed to load from file', e)
                }
            }
        },
        writeToFile(path: string) {
            try {
                // Convert Map to Object for JSON
                const obj: Record<string, any[]> = {}
                for (const [k, v] of messages.entries()) {
                    obj[k] = v
                }
                fs.writeFileSync(path, JSON.stringify(obj, null, 2))
            } catch (e) {
                console.error('[Store] Failed to write to file', e)
            }
        }
    }
}

const store = makeSimpleStore()
const STORE_FILE = 'auth_info_baileys/baileys_store.json'
store.readFromFile(STORE_FILE)
setInterval(() => {
    store.writeToFile(STORE_FILE)
}, 30_000)

// --- RETRY CACHE (Robust Interface) ---
const msgRetryCounterCache = {
    _map: new Map<string, number>(),
    get: function (key: string) { return this._map.get(key) },
    set: function (key: string, value: number) { this._map.set(key, value) },
    del: function (key: string) { this._map.delete(key) },
    flushAll: function () { this._map.clear() }
}

// Simple Cache for recent messages
const messageCache = new Map<string, WAMessage>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 Minutes

const server = fastify({
    logger: { level: 'info' }
})

// Middleware for Auth
server.addHook('preHandler', async (request, reply) => {
    // Allow /status (used by lib/whatsapp.ts and health checks) and /api/status (legacy/standard)
    // Also allow the root for health checkers to avoid log spam (optional, but good practice to just 200 or 404 cleanly)
    const allowedPaths = ['/status', '/api/status']
    const urlPath = request.url.split('?')[0]

    // If exact match
    if (allowedPaths.includes(urlPath)) return

    // Allow Media route with auth? (Logic falls through to check API Key)

    const apiKey = request.headers['x-api-key']
    if (apiKey !== AUTH_TOKEN) {
        reply.code(401).send({ error: 'Unauthorized' })
    }
})

// Mock silent logger to satisfy Baileys requirements without import issues
const silentLogger: any = {
    level: 'silent',
    trace: () => { },
    debug: () => { },
    info: () => { },
    warn: () => { },
    error: () => { },
    fatal: () => { },
    child: () => silentLogger
}

let sock: any = null
let currentStatus = 'STARTING'
let currentQR: string | null = null

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    const { version, isLatest } = await fetchLatestBaileysVersion()

    server.log.info(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

    // Fix: msgRetryCounterCache must implement CacheStore interface (get/set/del/flushAll)
    // We use 'any' for the map to satisfy the generic CacheStore requirement, 
    // effectively it stores numbers for retries.
    const retryMap = new Map<string, any>()
    const msgRetryCounterCache = {
        get: <T>(key: string) => retryMap.get(key) as T | undefined,
        set: <T>(key: string, value: T) => { retryMap.set(key, value) },
        del: (key: string) => { retryMap.delete(key) },
        flushAll: () => { retryMap.clear() }
    }

    sock = makeWASocket({
        version,
        printQRInTerminal: false, // handled via event
        generateHighQualityLinkPreview: false, // performance optimization
        syncFullHistory: false, // fast startup (bot mode)
        markOnlineOnConnect: false, // Don't appear online immediately/constantly
        connectTimeoutMs: 60_000,   // Longer timeout to avoid "Timed Out" loops
        defaultQueryTimeoutMs: 60_000,
        keepAliveIntervalMs: 10_000, // Keep connection alive actively
        retryRequestDelayMs: 5000, // Wait before retrying failed requests (helps with Bad MAC)
        logger: silentLogger,
        auth: {
            creds: state.creds,
            // Caching keys is CRITICAL to prevent 'closed session' errors and improve performance
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        msgRetryCounterCache, // REQUIRED for reliable delivery
        // REQUIRED: Handler to allow Baileys to resend messages if needed (prevent hangs)
        getMessage: async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid!, key.id!)
                return msg?.message || undefined
            }
            return undefined
        }
    })

    store.bind(sock.ev)

    sock.ev.on('creds.update', saveCreds)



    // Map<LID, PN> to resolve real numbers
    const lidToPnMap = new Map<string, string>()
    const MAP_FILE = 'auth_info_baileys/lid_map.json'

    // Load Map
    if (fs.existsSync(MAP_FILE)) {
        try {
            const data = fs.readFileSync(MAP_FILE, 'utf-8')
            const obj = JSON.parse(data)
            for (const [key, val] of Object.entries(obj)) {
                lidToPnMap.set(key, val as string)
            }
            server.log.info(`Loaded ${lidToPnMap.size} LID mappings from disk`)
        } catch (e: any) {
            server.log.error({ err: e }, 'Failed to load LID map')
        }
    }

    const saveMap = () => {
        try {
            const obj = Object.fromEntries(lidToPnMap)
            fs.writeFileSync(MAP_FILE, JSON.stringify(obj, null, 2))
        } catch (e: any) {
            server.log.error({ err: e }, 'Failed to save LID map')
        }
    }

    // ... inside existing code ...

    sock.ev.on('connection.update', (update: any) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            currentStatus = 'SCAN_QR_CODE'
            currentQR = qr
            server.log.info('QR Code generated')
            qrcode.generate(qr, { small: true })
        }

        if (connection === 'close') {
            currentStatus = 'DISCONNECTED'
            currentQR = null
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            server.log.info(`Connection closed due to ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`)
            if (shouldReconnect) {
                // SAFETY: Exponential Backoff to prevent Ban
                // INCREASED due to recent restriction: Min 20s, Max 60s
                const delayStr = process.env.RECONNECT_DELAY || '20000'
                const baseDelay = parseInt(delayStr)
                const actualDelay = baseDelay + Math.random() * 40000
                server.log.info(`Waiting ${actualDelay}ms before reconnecting...`)
                setTimeout(connectToWhatsApp, actualDelay)
            }
        } else if (connection === 'open') {
            currentStatus = 'CONNECTED'
            currentQR = null
            server.log.info('Opened connection')
        }
    })

    // Listen for Contact Updates to build LID->PN Map
    sock.ev.on('contacts.upsert', (contacts: any) => {
        let changed = false
        // DEBUG: Log first few contacts to see structure
        if (contacts.length > 0) {
            server.log.info({ firstContact: contacts[0], count: contacts.length }, 'Contacts Upsert Raw Sample')
        }
        for (const c of contacts) {
            // Log if we see a split (LID + ID) but maybe format is different
            if (c.lid || c.id) {
                // Trace potential matches
                if (c.lid && !lidToPnMap.has(c.lid)) {
                    // server.log.info({ item: c }, 'Examining Contact for LID') // Too spammy?
                }
            }

            if (c.lid && c.id && c.id.endsWith('@s.whatsapp.net')) {
                lidToPnMap.set(c.lid, c.id)
                changed = true
                server.log.info({ lid: c.lid, pn: c.id }, 'Mapped LID to PN')
            }
        }
        if (changed) saveMap()
    })

    sock.ev.on('contacts.update', (updates: any) => {
        let changed = false
        for (const c of updates) {
            if (c.lid && c.id && c.id.endsWith('@s.whatsapp.net')) {
                lidToPnMap.set(c.lid, c.id)
                changed = true
                server.log.info({ lid: c.lid, pn: c.id }, 'Updated Mapped LID to PN')
            }
        }
        if (changed) saveMap()
    })


    // Webhook Logic
    sock.ev.on('messages.upsert', async (m: any) => {
        server.log.info({ msg: 'messages.upsert received', count: m.messages.length, type: m.type })

        if (!WEBHOOK_URL) {
            server.log.warn('WEBHOOK_URL not configured, skipping webhook')
            return
        }

        try {
            const msg = m.messages[0]
            if (!msg.message) return // Protocol message?

            // Normalize JID
            let from = msg.key.remoteJid || ''
            let realPn = null

            // If LID, try to resolve to PN for display
            if (from.includes('@lid')) {
                let resolved = lidToPnMap.get(from)

                // Fallback: Check if message key contains senderPn (Baileys v6.7+ feature)
                if (!resolved && (msg.key as any).senderPn) {
                    resolved = (msg.key as any).senderPn
                    // Self-heal: Save to map
                    lidToPnMap.set(from, resolved as string)
                    saveMap()
                    server.log.info({ lid: from, resolved, source: 'senderPn' }, 'Self-healed LID mapping from Message Key')
                }

                if (resolved) {
                    realPn = resolved.replace('@s.whatsapp.net', '') // just the number
                    server.log.info({ lid: from, resolved: realPn }, 'Resolved LID to PN for Webhook')
                } else {
                    // DEBUG: Dump the full message to find the phone number
                    server.log.warn({ lid: from, msgKey: msg.key, msgStruct: msg }, 'Could not resolve LID to PN (yet) - RAW DUMP')
                }
            } else {
                from = from.replace('@s.whatsapp.net', '@c.us')
            }


            // Cache Message for Media Retrieval
            const msgId = msg.key.id
            if (msgId) {
                messageCache.set(msgId, msg)
                // Schedule Cleanup
                setTimeout(() => messageCache.delete(msgId), CACHE_TTL_MS)
            }

            // Track Last Message for Read Receipts (Blue Ticks)
            if (msg.key.remoteJid && !msg.key.fromMe) {
                lastMessageMap.set(msg.key.remoteJid, msg.key)
                saveLastKeys() // Persist immediately
            }

            // Normalize JID: Baileys uses @s.whatsapp.net, WAHA uses @c.us

            const fromMe = msg.key.fromMe
            const senderName = msg.pushName || 'Unknown'

            // Determine body
            let body = ''
            if (msg.message.conversation) body = msg.message.conversation
            else if (msg.message.extendedTextMessage?.text) body = msg.message.extendedTextMessage.text
            else if (msg.message.imageMessage?.caption) body = msg.message.imageMessage.caption
            else if (msg.message.videoMessage?.caption) body = msg.message.videoMessage.caption
            else if (msg.message.audioMessage) body = '[Voice Message]' // Placeholder

            // Determine mimetype/type for media
            let mimetype = null
            if (msg.message.imageMessage) mimetype = msg.message.imageMessage.mimetype
            else if (msg.message.videoMessage) mimetype = msg.message.videoMessage.mimetype
            else if (msg.message.audioMessage) mimetype = msg.message.audioMessage.mimetype

            // Construct WAHA-compatible Payload
            const payload = {
                event: 'message',
                payload: {
                    id: msgId,
                    from: from,
                    body: body,
                    fromMe: fromMe,
                    type: msg.message.audioMessage ? 'ptt' : (msg.message.imageMessage ? 'image' : 'chat'), // Simple type deduction
                    _data: {
                        notifyName: senderName,
                        mimetype: mimetype,
                        isViewOnce: msg.message.viewOnceMessage || msg.message.viewOnceMessageV2 ? true : false,
                        phoneNumber: realPn // Send resolved real number to Webhook
                    }
                }
            }

            const response = await axios.post(WEBHOOK_URL, payload, {
                headers: {
                    'x-internal-secret': WEBHOOK_SECRET || ''
                }
            })
            server.log.info({ msg: 'Webhook sent successfully', status: response.status, url: WEBHOOK_URL })
        } catch (err: any) {
            server.log.error(`Webhook failed: ${err.message}`)
            if (err.response) {
                server.log.error({ status: err.response.status, data: err.response.data })
            }
        }
    })
}

// --- API ROUTES ---

// Download Media
server.get('/api/messages/:id/media', async (request: any, reply) => {
    const { id } = request.params

    const msg = messageCache.get(id)
    if (!msg) {
        return reply.code(404).send({ error: 'Message not found or expired in cache' })
    }

    try {
        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            {
                logger: silentLogger,
                reuploadRequest: sock.updateMediaMessage // Helper to refresh url if needed
            }
        )

        // Helper to extract mimetype again
        let mimetype = 'application/octet-stream'
        if (msg.message?.imageMessage) mimetype = msg.message.imageMessage.mimetype || mimetype
        else if (msg.message?.audioMessage) mimetype = msg.message.audioMessage.mimetype || mimetype
        else if (msg.message?.videoMessage) mimetype = msg.message.videoMessage.mimetype || mimetype

        reply.header('Content-Type', mimetype)
        return reply.send(buffer)

    } catch (e: any) {
        server.log.error(e)
        return reply.code(500).send({ error: 'Failed to download media: ' + e.message })
    }
})

// --- API ROUTES ---

// Status (public) - Supports both /status and /api/status convention
const statusHandler = async (request: any, reply: any) => {
    return {
        status: currentStatus,
        qr: currentQR,
        engine: 'baileys'
    }
}
server.get('/status', statusHandler)
server.get('/api/status', statusHandler)

// Send Text
server.post('/api/sendText', async (request: any, reply) => {
    const { chatId, text, replyTo } = request.body

    if (!chatId || !text) {
        return reply.code(400).send({ error: 'Missing chatId or text' })
    }

    // Format JID: Standardize to s.whatsapp.net for individuals to avoid USync overhead/timeouts
    const jid = chatId.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`

    server.log.info({ msg: 'Attempting to send text', jid, textLength: text.length })

    // Retry Logic (Internal)
    let attempts = 0
    const maxAttempts = 3

    while (attempts < maxAttempts) {
        try {
            await sock.sendMessage(jid, { text: text })
            return { success: true, status: 'sent', attempts: attempts + 1 }
        } catch (e: any) {
            attempts++
            server.log.error({ msg: 'SendText attempt failed', error: e.message, attempt: attempts })

            if (attempts >= maxAttempts) {
                return reply.code(500).send({ error: e.message })
            }
            // Wait 1s before retry
            await new Promise(r => setTimeout(r, 1000))
        }
    }
})

// Send Voice
server.post('/api/sendVoice', async (request: any, reply) => {
    const { chatId, file, replyTo } = request.body
    // file: { data (base64), mimetype, filename }

    if (!chatId || !file || !file.data) {
        return reply.code(400).send({ error: 'Missing chatId or file data' })
    }

    const jid = chatId.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`

    try {
        const buffer = Buffer.from(file.data, 'base64')
        await sock.sendMessage(jid, {
            audio: buffer,
            mimetype: 'audio/mp4',
            ptt: true // Send as Voice Note (Blue Mic)
        })
        return { success: true, status: 'sent' }
    } catch (e: any) {
        server.log.error(e)
        return reply.code(500).send({ error: e.message })
    }
})

// Send File
server.post('/api/sendFile', async (request: any, reply) => {
    const { chatId, file, caption } = request.body

    if (!chatId || !file || !file.data) {
        return reply.code(400).send({ error: 'Missing chatId or file data' })
    }

    const jid = chatId.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`

    try {
        const buffer = Buffer.from(file.data, 'base64')

        // Detect type broadly
        let content: any = {}
        if (file.mimetype.startsWith('image')) {
            content = { image: buffer, caption: caption }
        } else if (file.mimetype.startsWith('video')) {
            content = { video: buffer, caption: caption }
        } else {
            content = { document: buffer, mimetype: file.mimetype, fileName: file.filename, caption: caption }
        }

        await sock.sendMessage(jid, content)
        return { success: true, status: 'sent' }
    } catch (e: any) {
        server.log.error(e)
        return reply.code(500).send({ error: e.message })
    }
})

// Send Typing State
server.post('/api/sendStateTyping', async (request: any, reply) => {
    const { chatId, isTyping } = request.body
    if (!chatId) return reply.code(400).send({ error: 'Missing chatId' })
    const jid = chatId.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`
    try {
        await sock.sendPresenceUpdate(isTyping ? 'composing' : 'available', jid)
        return { success: true }
    } catch (e: any) {
        server.log.error(e)
        return reply.code(500).send({ error: e.message })
    }
})

// Mark Seen (Real)
server.post('/api/markSeen', async (request: any, reply) => {
    const { chatId } = request.body
    if (!chatId) return reply.code(400).send({ error: 'Missing chatId' })
    const jid = chatId.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`

    try {
        // 1. Find recent unread messages from this JID in Cache
        const keysToRead: any[] = []
        for (const [id, msg] of messageCache.entries()) {
            if (msg.key.remoteJid === jid && !msg.key.fromMe) {
                keysToRead.push(msg.key)
            }
        }

        if (keysToRead.length > 0) {
            server.log.info({ jid, count: keysToRead.length }, 'Marking messages as read')
            await sock.readMessages(keysToRead)
        }

        // Fallback / Catch-all: Ensure the chat is marked as read up to the last known message
        const lastKey = lastMessageMap.get(jid)
        if (lastKey) {
            // This ensures "Blue Ticks" for older messages not in cache or if readMessages missed some
            await sock.chatModify({ markRead: true, lastMessages: [{ key: lastKey }] }, jid).catch((err: any) => {
                server.log.warn({ err }, 'Failed to chatModify (markRead)')
            })
            server.log.info({ jid }, 'Force marked chat as read via chatModify')
        } else {
            // Blind mark as read if we have no key (clears badge but might not blue tick old msgs)
            await sock.chatModify({ markRead: true, lastMessages: [] }, jid).catch(() => { })
        }

        return { success: true, readCount: keysToRead.length }
    } catch (e: any) {
        server.log.error(e)
        return reply.code(500).send({ error: e.message })
    }
})





// --- Cron Logic (Self-Healing) ---
const CRON_URL = process.env.CRON_URL || (WEBHOOK_URL ? WEBHOOK_URL.replace('/webhooks/whatsapp', '/cron/process-queue') : null)

if (CRON_URL) {
    server.log.info({ cronUrl: CRON_URL }, 'Initializing Queue Trigger (Cron Pinger)')
    setInterval(async () => {
        try {
            // Fire and forget, but log failures occasionally
            await axios.get(CRON_URL, { timeout: 5000 })
        } catch (e: any) {
            // Log error to help debug why messages aren't leaving
            server.log.warn({ error: e.message, url: CRON_URL }, 'Cron Pinger Failed')
        }
    }, 10000)
} else {
    server.log.warn('CRON_URL could not be derived. Queue auto-processing disabled.')
}


// --- Last Message Tracking for Robust Read Receipts ---
const lastMessageMap = new Map<string, any>() // JID -> MessageKey
const LAST_MSG_FILE = 'auth_info_baileys/last_msg_map.json'

// Load Last Keys
if (fs.existsSync(LAST_MSG_FILE)) {
    try {
        const data = fs.readFileSync(LAST_MSG_FILE, 'utf-8')
        const obj = JSON.parse(data)
        for (const [key, val] of Object.entries(obj)) {
            lastMessageMap.set(key, val)
        }
        server.log.info(`Loaded ${lastMessageMap.size} Last Message Keys from disk`)
    } catch (e) {
        server.log.error('Failed to load Last Message Map')
    }
}

const saveLastKeys = () => {
    try {
        const obj = Object.fromEntries(lastMessageMap)
        fs.writeFileSync(LAST_MSG_FILE, JSON.stringify(obj, null, 2))
    } catch (e) {
        server.log.error('Failed to save Last Message Map')
    }
}

// ... (existing helper function could go here)

const start = async () => {
    try {
        await server.listen({ port: PORT, host: '0.0.0.0' })
        server.log.info(`Server listening on port ${PORT}`)

        // Connect
        connectToWhatsApp()

    } catch (err) {
        server.log.error(err)
        process.exit(1)
    }
}

start()
