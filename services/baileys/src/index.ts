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
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const PORT = 3001
const WEBHOOK_URL = process.env.WEBHOOK_URL
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'secret'

// Simple Cache for recent messages to enable media download by ID
// Map<MessageID, WAMessage>
const messageCache = new Map<string, WAMessage>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 Minutes

const server = fastify({
    logger: { level: 'warn' }
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

    sock = makeWASocket({
        version,
        logger: silentLogger,
        printQRInTerminal: false, // We handle it manually
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
        },
        generateHighQualityLinkPreview: true,
        // Remove default retry to avoid excessive noise
    })

    sock.ev.on('creds.update', saveCreds)



    // Map<LID, PN> to resolve real numbers
    const lidToPnMap = new Map<string, string>()

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
                const delayStr = process.env.RECONNECT_DELAY || '5000'
                const baseDelay = parseInt(delayStr)
                const actualDelay = baseDelay + Math.random() * 5000
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
        for (const c of contacts) {
            if (c.lid && c.id && c.id.endsWith('@s.whatsapp.net')) {
                lidToPnMap.set(c.lid, c.id)
                server.log.info({ lid: c.lid, pn: c.id }, 'Mapped LID to PN')
            }
        }
    })

    sock.ev.on('contacts.update', (updates: any) => {
        for (const c of updates) {
            if (c.lid && c.id && c.id.endsWith('@s.whatsapp.net')) {
                lidToPnMap.set(c.lid, c.id)
                server.log.info({ lid: c.lid, pn: c.id }, 'Updated Mapped LID to PN')
            }
        }
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
                const resolved = lidToPnMap.get(from)
                if (resolved) {
                    realPn = resolved.replace('@s.whatsapp.net', '') // just the number
                    server.log.info({ lid: from, resolved: realPn }, 'Resolved LID to PN for Webhook')
                } else {
                    server.log.warn({ lid: from }, 'Could not resolve LID to PN (yet)')
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

            const response = await axios.post(WEBHOOK_URL, payload)
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

    // Format JID
    const jid = chatId.includes('@') ? chatId : `${chatId}@c.us`

    try {
        await sock.sendMessage(jid, { text: text })
        return { success: true, status: 'sent' }
    } catch (e: any) {
        server.log.error(e)
        return reply.code(500).send({ error: e.message })
    }
})

// Send Voice
server.post('/api/sendVoice', async (request: any, reply) => {
    const { chatId, file, replyTo } = request.body
    // file: { data (base64), mimetype, filename }

    if (!chatId || !file || !file.data) {
        return reply.code(400).send({ error: 'Missing chatId or file data' })
    }

    const jid = chatId.includes('@') ? chatId : `${chatId}@c.us`

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

    const jid = chatId.includes('@') ? chatId : `${chatId}@c.us`

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
    const jid = chatId.includes('@') ? chatId : `${chatId}@c.us`
    try {
        await sock.sendPresenceUpdate(isTyping ? 'composing' : 'available', jid)
        return { success: true }
    } catch (e: any) {
        server.log.error(e)
        return reply.code(500).send({ error: e.message })
    }
})

// Mark Seen (Mock for now to prevent 404s)
server.post('/api/markSeen', async (request: any, reply) => {
    return { success: true, status: 'ignored_safe' }
})





const start = async () => {
    try {
        await server.listen({ port: PORT, host: '0.0.0.0' })
        server.log.info(`Server listening on port ${PORT}`)
        connectToWhatsApp()
    } catch (err) {
        server.log.error(err)
        process.exit(1)
    }
}

start()
