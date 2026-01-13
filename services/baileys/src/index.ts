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
import qrcode from 'qrcode-terminal'
import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import { setupLogIngestion } from './log-receiver.js'

dotenv.config()

const PORT = 3001
const WEBHOOK_URL = process.env.WEBHOOK_URL
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
const AUTH_TOKEN = process.env.AUTH_TOKEN

if (!AUTH_TOKEN) {
    console.error('FATAL: AUTH_TOKEN is not defined. Exiting.')
    process.exit(1)
}

// Global Error Handlers to prevent crash
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
})
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

const BASE_AUTH_DIR = 'auth_info_baileys'
if (!fs.existsSync(BASE_AUTH_DIR)) {
    fs.mkdirSync(BASE_AUTH_DIR, { recursive: true })
}

// Global logger buffer
const LOG_BUFFER_SIZE = 500
const logBuffer: string[] = []
function addToLogBuffer(line: string) {
    logBuffer.push(line)
    if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift()
}

// --- PERSISTENCE UTILS ---
const LID_MAP_FILE = 'lid_map.json'
const LID_MAP_PATH = path.join(BASE_AUTH_DIR, LID_MAP_FILE)

function loadLidMap(): Map<string, string> {
    if (fs.existsSync(LID_MAP_PATH)) {
        try {
            const data = fs.readFileSync(LID_MAP_PATH, 'utf-8')
            const json = JSON.parse(data)
            return new Map(Object.entries(json))
        } catch (e) {
            server.log.error({ err: e }, 'Failed to load LID map')
        }
    }
    return new Map()
}

// Debounce save to avoid thrashing disk
let saveLidTimeout: NodeJS.Timeout | null = null
function saveLidMap(map: Map<string, string>) {
    if (saveLidTimeout) clearTimeout(saveLidTimeout)
    saveLidTimeout = setTimeout(() => {
        try {
            const obj = Object.fromEntries(map)
            fs.writeFileSync(LID_MAP_PATH, JSON.stringify(obj, null, 2))
            server.log.info({ count: map.size }, 'LID Map saved to disk')
        } catch (e) {
            server.log.error({ err: e }, 'Failed to save LID map')
        }
    }, 5000) // Save after 5 seconds of inactivity
}

// --- SESSION MANAGEMENT ---

interface SessionData {
    id: string // Agent ID
    sock: any
    status: string // CONNECTED, SCAN_QR_CODE, STARTING, DISCONNECTED
    qr: string | null
    store: any
    messageCache: Map<string, WAMessage>
    lidToPnMap: Map<string, string>
    wasConnected: boolean // Track if session was ever successfully authenticated
    // Error tracking for auto-recovery
    badMacCount: number
    decryptErrors: number
    lastRepairTime: number
    isRepairing: boolean
}

// Map<agentId, SessionData>
const sessions = new Map<string, SessionData>()

const server = fastify({
    logger: { level: 'info' },
    disableRequestLogging: true
})

// Logging Hook
server.addHook('onResponse', async (request, reply) => {
    const urlPath = request.url.split('?')[0]
    // Skip noisy polling endpoints
    if (['/status', '/api/status', '/health', '/api/logs'].includes(urlPath)) return

    addToLogBuffer(`${new Date().toISOString()} [${request.method}] ${request.url} - ${reply.statusCode}`)
})

// Auth Middleware
server.addHook('preHandler', async (request, reply) => {
    const urlPath = request.url.split('?')[0]
    if (urlPath === '/status' || urlPath === '/api/status' || urlPath === '/health' || urlPath === '/api/logs/ingest') return

    const apiKey = request.headers['x-api-key']
    if (apiKey !== AUTH_TOKEN) {
        reply.code(401).send({ error: 'Unauthorized' })
    }
})

// Setup Log Ingestion Endpoint
setupLogIngestion(server)

/**
 * Helper to convert audio buffer to WAV using ffmpeg
 */
async function convertToWav(inputBuffer: Buffer): Promise<any> {
    const tempIn = path.join('/tmp', `input_${Date.now()}.ogg`)
    const tempOut = path.join('/tmp', `output_${Date.now()}.wav`)

    try {
        if (!fs.existsSync('/tmp')) fs.mkdirSync('/tmp', { recursive: true })
        fs.writeFileSync(tempIn, inputBuffer)

        await new Promise((resolve, reject) => {
            ffmpeg(tempIn)
                .toFormat('wav')
                .on('end', resolve)
                .on('error', reject)
                .save(tempOut)
        })

        const outputBuffer = fs.readFileSync(tempOut)
        return outputBuffer
    } finally {
        if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn)
        if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut)
    }
}

// --- STORE IMPLEMENTATION (Factory) ---
function makeSimpleStore(sessionId: string) {
    const messages = new Map<string, any[]>()

    return {
        messages,
        bind(ev: any) {
            ev.on('messages.upsert', (data: any) => {
                for (const m of data.messages) {
                    const jid = m.key.remoteJid
                    if (!jid) continue
                    const list = messages.get(jid) || []

                    const existingIdx = list.findIndex((ex: any) => ex.key.id === m.key.id)
                    if (existingIdx > -1) list[existingIdx] = m
                    else list.push(m)

                    if (list.length > 200) list.splice(0, list.length - 200)
                    messages.set(jid, list)
                }
            })
        },
        async loadMessage(jid: string, id: string) {
            let list = messages.get(jid)
            let found = list?.find((m: any) => m.key.id === id)
            // If not found, search all chats (deep search for LID/PN mismatch)
            if (!found) {
                for (const [chatJid, chatMsgs] of messages.entries()) {
                    if (chatJid === jid) continue
                    found = chatMsgs.find((m: any) => m.key.id === id)
                    if (found) break
                }
            }
            return found
        },
        // Simple persistence for this session
        writeToFile(filePath: string) {
            const obj: Record<string, any[]> = {}
            for (const [k, v] of messages.entries()) obj[k] = v
            try { fs.writeFileSync(filePath, JSON.stringify(obj)) } catch (e) { }
        },
        readFromFile(filePath: string) {
            if (fs.existsSync(filePath)) {
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
                    for (const jid in data) messages.set(jid, data[jid])
                } catch (e) { }
            }
        }
    }
}

// --- SESSION REPAIR FUNCTIONS ---

/**
 * Clean corrupted session parts WITHOUT deleting main credentials.
 * This allows repair without requiring a new QR scan.
 * It deletes:
 * - sender-keys/ (group encryption keys)
 * - app-state-sync-*.json (app state)
 * - pre-keys that may be corrupted
 */
async function cleanCorruptedSessionParts(sessionId: string): Promise<{ cleaned: string[], kept: string[] }> {
    const authPath = path.join(BASE_AUTH_DIR, `session_${sessionId}`)
    const cleaned: string[] = []
    const kept: string[] = []

    if (!fs.existsSync(authPath)) {
        return { cleaned: [], kept: [] }
    }

    const files = fs.readdirSync(authPath)

    for (const file of files) {
        const filePath = path.join(authPath, file)
        const stat = fs.statSync(filePath)

        // Keep essential credentials
        if (file === 'creds.json') {
            kept.push('creds.json')
            continue
        }

        // Delete sender-keys directory
        if (file === 'sender-key-memory.json' || file.startsWith('sender-key')) {
            if (stat.isDirectory()) {
                fs.rmSync(filePath, { recursive: true })
            } else {
                fs.unlinkSync(filePath)
            }
            cleaned.push(file)
            continue
        }

        // Delete app-state-sync files (can cause desync)
        if (file.startsWith('app-state-sync')) {
            fs.unlinkSync(filePath)
            cleaned.push(file)
            continue
        }

        // Delete pre-key files (will be regenerated)
        if (file.startsWith('pre-key-') || file === 'pre-keys.json') {
            fs.unlinkSync(filePath)
            cleaned.push(file)
            continue
        }

        // Delete session files per contact (will be re-negotiated)
        if (file.startsWith('session-')) {
            fs.unlinkSync(filePath)
            cleaned.push(file)
            continue
        }

        // Keep everything else
        kept.push(file)
    }

    return { cleaned, kept }
}

/**
 * Repair a session by cleaning corrupted parts and reconnecting.
 * This should fix "Waiting for this message" issues without QR rescan.
 */
async function repairSession(sessionId: string): Promise<{ success: boolean, message: string, details: any }> {
    const session = sessions.get(sessionId)

    // Check if repair already in progress
    if (session?.isRepairing) {
        return { success: false, message: 'Repair already in progress', details: {} }
    }

    // Check cooldown (minimum 30 seconds between repairs)
    const now = Date.now()
    if (session && (now - session.lastRepairTime) < 30000) {
        const waitTime = Math.ceil((30000 - (now - session.lastRepairTime)) / 1000)
        return { success: false, message: `Repair cooldown active. Wait ${waitTime}s`, details: {} }
    }

    console.log(`[Recovery] Starting session repair for ${sessionId}...`)

    if (session) {
        session.isRepairing = true
        session.lastRepairTime = now
    }

    try {
        // Step 1: Disconnect current session if active
        if (session) {
            try {
                session.sock.end(undefined)
            } catch (e) {
                // Ignore disconnect errors
            }
            sessions.delete(sessionId)
        }

        // Step 2: Clean corrupted session parts (keep creds.json)
        const cleanResult = await cleanCorruptedSessionParts(sessionId)
        console.log(`[Recovery] Cleaned: ${cleanResult.cleaned.join(', ') || 'nothing'}`)
        console.log(`[Recovery] Kept: ${cleanResult.kept.join(', ')}`)

        // Step 3: Wait a moment for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Step 4: Restart session
        await startSession(sessionId)

        // Reset error counters on the new session
        const newSession = sessions.get(sessionId)
        if (newSession) {
            newSession.badMacCount = 0
            newSession.decryptErrors = 0
            newSession.isRepairing = false
        }

        console.log(`[Recovery] Session ${sessionId} repair complete`)

        return {
            success: true,
            message: 'Session repaired successfully. No QR rescan needed.',
            details: {
                cleaned: cleanResult.cleaned,
                kept: cleanResult.kept
            }
        }
    } catch (error: any) {
        console.error(`[Recovery] Repair failed for ${sessionId}:`, error)

        if (session) {
            session.isRepairing = false
        }

        return {
            success: false,
            message: `Repair failed: ${error.message}`,
            details: {}
        }
    }
}

// --- SESSION STARTUP LOGIC ---
async function startSession(sessionId: string) {
    if (sessions.has(sessionId)) {
        server.log.info({ sessionId }, 'Session already active')
        return sessions.get(sessionId)
    }

    server.log.info({ sessionId }, 'Starting session...')

    const authFolder = path.join(BASE_AUTH_DIR, `session_${sessionId}`)
    if (!fs.existsSync(authFolder)) {
        fs.mkdirSync(authFolder, { recursive: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(authFolder)
    const { version, isLatest } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, server.log as any),
        },
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }) as any,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid!, key.id!)
                return msg?.message || undefined
            }
            return { conversation: 'hello' }
        }
    })

    // Custom Store with persistence
    const store = makeSimpleStore(sessionId)
    const STORE_FILE = path.join(authFolder, 'store.json')
    store.readFromFile(STORE_FILE)
    // Save every 30s
    const storeInterval = setInterval(() => {
        store.writeToFile(STORE_FILE)
    }, 30_000)

    store.bind(sock.ev)

    // Load LID Map from disk
    const persistentLidMap = loadLidMap()

    const sessionData: SessionData = {
        id: sessionId,
        sock,
        status: 'STARTING',
        qr: null,
        store,
        messageCache: new Map(),
        lidToPnMap: persistentLidMap, // Initialize with loaded map
        wasConnected: false,
        badMacCount: 0,
        decryptErrors: 0,
        lastRepairTime: 0,
        isRepairing: false
    }

    sessions.set(sessionId, sessionData)

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            sessionData.status = 'SCAN_QR_CODE'
            sessionData.qr = qr
            server.log.info({ sessionId }, 'QR Generated')
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
            const wasLoggedOut = statusCode === DisconnectReason.loggedOut
            const wasQrTimeout = statusCode === 408 // QR refs attempts ended

            sessionData.status = 'DISCONNECTED'
            server.log.info({ sessionId, statusCode, wasConnected: sessionData.wasConnected, error: lastDisconnect?.error }, 'Connection closed')

            // Always clean up old session reference to allow restart
            const wasConnected = sessionData.wasConnected
            sessions.delete(sessionId)
            clearInterval(storeInterval)

            // Note: We don't clear the interval here because it's defined inside startSession but not stored on sessionData
            // However, it's scoped to this closure, so it's tricky.
            // In the original code, storeInterval IS cleared. I must have missed re-implementing it here.

            // Only auto-reconnect if:
            // 1. Not logged out
            // 2. Session was previously connected (authenticated) OR it's not a QR timeout
            // This prevents infinite QR loop for never-scanned sessions
            const shouldReconnect = !wasLoggedOut && (wasConnected || !wasQrTimeout)

            if (shouldReconnect && wasConnected) {
                server.log.info({ sessionId }, 'Auto-reconnecting previously authenticated session...')
                setTimeout(() => startSession(sessionId), 5000)
            } else if (wasQrTimeout && !wasConnected) {
                server.log.info({ sessionId }, 'QR timeout - waiting for manual restart (user never scanned)')
            } else if (wasLoggedOut) {
                server.log.warn({ sessionId }, 'Session logged out. Need manual restart/scan.')
            }
        } else if (connection === 'open') {
            sessionData.status = 'CONNECTED'
            sessionData.qr = null
            sessionData.wasConnected = true // Mark as successfully authenticated
            server.log.info({ sessionId }, 'Connection OPEN - session authenticated')
        }
    })

    // Listen for Contact Updates to build LID->PN Map
    sock.ev.on('contacts.upsert', (contacts: any) => {
        let changed = false
        for (const c of contacts) {
            // Check if contact has both LID and phone number
            if (c.lid && c.id && c.id.endsWith('@s.whatsapp.net')) {
                const pn = c.id.replace('@s.whatsapp.net', '')
                sessionData.lidToPnMap.set(c.lid, pn)
                server.log.info({ sessionId, lid: c.lid, pn }, 'Mapped LID to PN from contacts.upsert')
                changed = true
            }
        }
        if (changed) saveLidMap(sessionData.lidToPnMap)
    })

    sock.ev.on('contacts.update', (updates: any) => {
        let changed = false
        for (const c of updates) {
            if (c.lid && c.id && c.id.endsWith('@s.whatsapp.net')) {
                const pn = c.id.replace('@s.whatsapp.net', '')
                sessionData.lidToPnMap.set(c.lid, pn)
                server.log.info({ sessionId, lid: c.lid, pn }, 'Updated LID to PN mapping from contacts.update')
                changed = true
            }
        }
        if (changed) saveLidMap(sessionData.lidToPnMap)
    })

    sock.ev.on('messages.upsert', async (m) => {
        // DEBUG: Log ALL incoming messages
        server.log.info({ sessionId, type: m.type, count: m.messages.length }, 'messages.upsert event received')

        // FIX: Only process NEW messages (notify), skip re-delivered ones (append)
        if (m.type !== 'notify') {
            server.log.info({ sessionId, type: m.type }, 'Ignoring non-notify upsert (re-delivered/append message)')
            return
        }

        if (!WEBHOOK_URL) {
            server.log.warn({ sessionId }, 'WEBHOOK_URL not configured - messages will NOT be forwarded!')
            return
        }

        try {
            const msg = m.messages[0]
            if (!msg.message) {
                // DEBUG: Log full message structure to understand what we're receiving
                server.log.info({
                    sessionId,
                    msgId: msg.key.id,
                    fullKey: msg.key,
                    hasMessageField: 'message' in msg,
                    messageType: msg.messageStubType,
                    status: msg.status,
                    rawKeys: Object.keys(msg)
                }, 'Message has no content - DEBUG')

                // REACTIVE AUTO-REPAIR: messageStubType 2 = CIPHERTEXT (decryption failed)
                if (msg.messageStubType === 2) {
                    sessionData.decryptErrors++
                    server.log.warn({ sessionId, decryptErrors: sessionData.decryptErrors }, 'Decrypt error detected (CIPHERTEXT stub)')

                    // AGGRESSIVE: Trigger repair on FIRST error
                    if (sessionData.decryptErrors >= 1 && !sessionData.isRepairing) {
                        server.log.warn({ sessionId }, 'Critical error (Bad MAC) - triggering IMMEDIATE auto-repair')
                        repairSession(sessionId).then(result => {
                            server.log.info({ sessionId, result: result.message }, 'Auto-repair completed')
                        }).catch(err => {
                            server.log.error({ sessionId, err: err.message }, 'Auto-repair failed')
                        })
                    }
                }
                return
            }

            // FIX: Ignore old messages delivered during reconnection sync
            const msgTimestamp = msg.messageTimestamp
            const nowSeconds = Math.floor(Date.now() / 1000)
            const msgAgeSeconds = msgTimestamp ? nowSeconds - Number(msgTimestamp) : 0
            if (msgAgeSeconds > 30) {
                server.log.info({ sessionId, msgId: msg.key.id, ageSeconds: msgAgeSeconds }, 'Ignoring stale message (older than 30s, likely reconnection sync)')
                return
            }

            // Determine Body
            let body = msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                msg.message.imageMessage?.caption ||
                ''

            // Determine Type
            let type = 'chat'
            if (msg.message.imageMessage) type = 'image'
            if (msg.message.audioMessage) type = 'ptt'

            server.log.info({ sessionId, from: msg.key.remoteJid, type, fromMe: msg.key.fromMe, bodyPreview: body.substring(0, 50) }, 'Processing message')

            // LID to Phone Number Resolution
            let resolvedPhoneNumber: string | null = null
            const remoteJid = msg.key.remoteJid || ''

            if (remoteJid.includes('@lid')) {
                server.log.info({ sessionId, lid: remoteJid }, 'Attempting LID resolution...')

                // Method 1: Check if participant contains phone number (for some message types)
                const participant = msg.key.participant
                if (participant && participant.includes('@s.whatsapp.net')) {
                    resolvedPhoneNumber = participant.replace('@s.whatsapp.net', '')
                    server.log.info({ sessionId, method: 'participant', pn: resolvedPhoneNumber }, 'LID resolved via participant')
                }

                // Method 2: Check remoteJidAlt if available (newer Baileys versions)
                if (!resolvedPhoneNumber && (msg.key as any).remoteJidAlt) {
                    const alt = (msg.key as any).remoteJidAlt
                    if (alt.includes('@s.whatsapp.net')) {
                        resolvedPhoneNumber = alt.replace('@s.whatsapp.net', '')
                        server.log.info({ sessionId, method: 'remoteJidAlt', pn: resolvedPhoneNumber }, 'LID resolved via remoteJidAlt')
                    }
                }

                // Method 3: Check signal repository lid mapping (cast to any for newer Baileys features)
                if (!resolvedPhoneNumber) {
                    const signalRepo = sock.signalRepository as any
                    if (signalRepo?.lidMapping) {
                        const lidKey = remoteJid.split('@')[0]
                        const mapping = signalRepo.lidMapping
                        if (mapping && typeof mapping.get === 'function') {
                            resolvedPhoneNumber = mapping.get(lidKey) || null
                            if (resolvedPhoneNumber) {
                                server.log.info({ sessionId, method: 'signalRepository.lidMapping', pn: resolvedPhoneNumber }, 'LID resolved via signal repo')
                            }
                        }
                    }
                }

                // Method 4: Check session's lidToPnMap (our custom cache)
                if (!resolvedPhoneNumber) {
                    const lidKey = remoteJid.split('@')[0]
                    resolvedPhoneNumber = sessionData.lidToPnMap.get(lidKey) || null
                    if (resolvedPhoneNumber) {
                        server.log.info({ sessionId, method: 'lidToPnMap', pn: resolvedPhoneNumber }, 'LID resolved via local cache')
                    }
                }

                // Method 5: Check senderPn in message key (Baileys v6.7+ feature)
                if (!resolvedPhoneNumber && (msg.key as any).senderPn) {
                    const senderPn = (msg.key as any).senderPn
                    resolvedPhoneNumber = senderPn.replace('@s.whatsapp.net', '')
                    // Self-heal: Save to map for future lookups
                    const lidKey = remoteJid.split('@')[0]
                    sessionData.lidToPnMap.set(lidKey, resolvedPhoneNumber!)
                    saveLidMap(sessionData.lidToPnMap) // Save on discovery
                    server.log.info({ sessionId, method: 'senderPn', pn: resolvedPhoneNumber }, 'LID resolved via senderPn (self-healed)')
                }

                if (!resolvedPhoneNumber) {
                    server.log.warn({ sessionId, lid: remoteJid }, 'Could not resolve LID - sending to webhook anyway with LID')
                }
            }

            // Prepare Payload
            const payload = {
                sessionId, // IMPORTANT: Inject Agent ID
                event: 'message',
                payload: {
                    id: msg.key.id,
                    from: msg.key.remoteJid,
                    body,
                    fromMe: msg.key.fromMe,
                    type,
                    messageKey: msg.key, // Full key for read receipts
                    _data: {
                        notifyName: msg.pushName,
                        phoneNumber: resolvedPhoneNumber // Include resolved phone number for LID messages
                    }
                }
            }

            // Cache for media retrieval BEFORE webhook (so it's available when app requests download)
            if (msg.key.id) {
                sessionData.messageCache.set(msg.key.id, msg)
                server.log.info({ sessionId, msgId: msg.key.id, cacheSize: sessionData.messageCache.size }, 'Message cached for media retrieval')
                setTimeout(() => sessionData.messageCache.delete(msg.key.id!), 600000) // 10min TTL for media
            }

            server.log.info({ sessionId, webhookUrl: WEBHOOK_URL }, 'Sending to webhook...')
            const response = await axios.post(WEBHOOK_URL, payload, { headers: { 'x-internal-secret': WEBHOOK_SECRET || '' } })
            server.log.info({ sessionId, status: response.status }, 'Webhook call successful')

        } catch (e: any) {
            server.log.error({ sessionId, err: e.message, response: e.response?.data }, 'Webhook call FAILED')
        }
    })

    return sessionData
}


// --- API ROUTES ---

// List Sessions
server.get('/api/sessions', async (req, reply) => {
    const list = Array.from(sessions.values()).map(s => ({
        id: s.id,
        status: s.status,
        qr: s.qr
    }))
    return { sessions: list }
})

// Start Session (Create/Resume)
server.post('/api/sessions/start', async (req: any, reply) => {
    const { sessionId } = req.body
    if (!sessionId) return reply.code(400).send({ error: 'Missing sessionId' })

    startSession(sessionId)
    return { success: true, message: 'Session initialization started' }
})

// Stop Session
server.post('/api/sessions/stop', async (req: any, reply) => {
    const { sessionId } = req.body
    if (!sessionId) return reply.code(400).send({ error: 'Missing sessionId' })

    const session = sessions.get(sessionId)
    if (session) {
        session.sock.end(undefined)
        sessions.delete(sessionId)
        return { success: true }
    }
    return reply.code(404).send({ error: 'Session not found' })
})

// Reset Session (Clear all auth data and restart fresh)
server.post('/api/sessions/reset', async (req: any, reply) => {
    const { sessionId } = req.body
    if (!sessionId) return reply.code(400).send({ error: 'Missing sessionId' })

    server.log.info({ sessionId }, 'Resetting session (clearing auth data)...')

    // 1. Stop existing session if running
    const session = sessions.get(sessionId)
    if (session) {
        try { session.sock.end(undefined) } catch (e) { }
        sessions.delete(sessionId)
    }

    // 2. Delete auth folder
    const authPath = path.join(BASE_AUTH_DIR, `session_${sessionId}`)
    if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true })
        server.log.info({ sessionId, authPath }, 'Auth data deleted')
    }

    // 3. Start fresh session
    await startSession(sessionId)

    return { success: true, message: 'Session reset. Scan new QR code.' }
})

// Delete Session PERMANENTLY (Stop + remove auth data, NO restart)
server.post('/api/sessions/delete', async (req: any, reply) => {
    const { sessionId } = req.body
    if (!sessionId) return reply.code(400).send({ error: 'Missing sessionId' })

    server.log.info({ sessionId }, 'Deleting session permanently...')

    // 1. Stop existing session if running
    const session = sessions.get(sessionId)
    if (session) {
        try { session.sock.end(undefined) } catch (e) { }
        sessions.delete(sessionId)
    }

    // 2. Delete auth folder
    const authPath = path.join(BASE_AUTH_DIR, `session_${sessionId}`)
    if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true })
        server.log.info({ sessionId, authPath }, 'Auth data deleted permanently')
    }

    // NO restart - session is gone forever
    return { success: true, message: 'Session deleted permanently' }
})

// Repair Session (Clean corrupted parts WITHOUT full reset - no QR rescan needed)
server.post('/api/sessions/repair', async (req: any, reply) => {
    const { sessionId } = req.body
    if (!sessionId) return reply.code(400).send({ error: 'Missing sessionId' })

    server.log.info({ sessionId }, 'Repairing session (cleaning corrupted parts)...')

    const result = await repairSession(sessionId)

    if (!result.success) {
        return reply.code(400).send(result)
    }

    return result
})

// Get Status (Compat with multiple)
server.get('/api/sessions/:sessionId/status', async (req: any, reply) => {
    const { sessionId } = req.params
    const session = sessions.get(sessionId)
    if (!session) return { status: 'UNKNOWN' }
    return { status: session.status, qr: session.qr }
})

// Global Status (Fallback for single-session legacy calls)
server.get('/status', async (req, reply) => {
    // Return the status of the first available session or 'default'
    let targetSession = sessions.get('default')
    if (!targetSession && sessions.size > 0) {
        targetSession = sessions.values().next().value
    }

    if (!targetSession) {
        return { status: 'DISCONNECTED', qr: null, message: 'No active sessions' }
    }

    return { status: targetSession.status, qr: targetSession.qr }
})

// Get Logs (for admin dashboard)
server.get('/api/logs', async (req: any, reply) => {
    const lines = parseInt(req.query.lines as string) || 100
    const recentLogs = logBuffer.slice(-lines)
    return { success: true, lines: recentLogs }
})

// Send Text (Must include sessionId)
server.post('/api/sendText', async (req: any, reply) => {
    const { sessionId, chatId, text } = req.body

    // Fallback for single-session legacy calls? 
    // If no sessionId provided, try 'default' or the first one available
    let targetSessionId = sessionId
    if (!targetSessionId) {
        if (sessions.size === 1) targetSessionId = sessions.keys().next().value
        else if (sessions.has('default')) targetSessionId = 'default'
    }

    const session = sessions.get(targetSessionId)
    if (!session) return reply.code(404).send({ error: 'Session not found', targetSessionId })

    const jid = chatId.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`

    try {
        await session.sock.sendMessage(jid, { text })
        return { success: true }
    } catch (e: any) {
        return reply.code(500).send({ error: e.message })
    }
})

// Mark as Read/Seen
server.post('/api/markSeen', async (req: any, reply) => {
    const { sessionId, chatId, messageId, messageKey } = req.body
    const session = sessions.get(sessionId || 'default')
    if (!session) return reply.code(404).send({ error: 'Session not found' })

    try {
        // Best case: Full messageKey provided by caller (from webhook payload)
        if (messageKey && messageKey.remoteJid && messageKey.id) {
            await session.sock.readMessages([messageKey])
            server.log.info({ sessionId, messageKey }, 'Marked message as read (direct key)')
            return { success: true, method: 'direct_key' }
        }

        // If messageId is provided, try to get the message from cache
        if (messageId && session.messageCache.has(messageId)) {
            const cachedMsg = session.messageCache.get(messageId)
            if (cachedMsg?.key) {
                await session.sock.readMessages([cachedMsg.key])
                server.log.info({ sessionId, chatId, messageId }, 'Marked message as read (cache)')
                return { success: true, method: 'cache' }
            }
        }

        // Fallback: construct key from chatId
        const jid = chatId?.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`
        const fallbackKey = {
            remoteJid: jid,
            id: messageId || 'unknown',
            fromMe: false
        }
        await session.sock.readMessages([fallbackKey])
        server.log.info({ sessionId, chatId, fallbackKey }, 'Marked as read (fallback key)')
        return { success: true, method: 'fallback' }
    } catch (e: any) {
        server.log.error({ err: e, sessionId, chatId }, 'Failed to mark as read')
        return reply.code(500).send({ error: e.message })
    }
})

// Typing State
server.post('/api/sendStateTyping', async (req: any, reply) => {
    const { sessionId, chatId, isTyping } = req.body
    const session = sessions.get(sessionId || 'default')
    if (!session) return reply.code(404).send({ error: 'Session not found' })

    const jid = chatId.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`

    try {
        await session.sock.sendPresenceUpdate(isTyping ? 'composing' : 'available', jid)
        return { success: true }
    } catch (e: any) {
        return reply.code(500).send({ error: e.message })
    }
})

// Recording State
server.post('/api/sendStateRecording', async (req: any, reply) => {
    const { sessionId, chatId, isRecording } = req.body
    const session = sessions.get(sessionId || 'default')
    if (!session) return reply.code(404).send({ error: 'Session not found' })

    const jid = chatId.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`

    try {
        await session.sock.sendPresenceUpdate(isRecording ? 'recording' : 'available', jid)
        return { success: true }
    } catch (e: any) {
        return reply.code(500).send({ error: e.message })
    }
})

/**
 * Helper to convert ANY audio to OGG/OPUS (for WhatsApp PTT)
 */
async function convertToOggOpus(inputBuffer: Buffer): Promise<any> {
    const tempIn = path.join('/tmp', `to_ogg_in_${Date.now()}`)
    const tempOut = path.join('/tmp', `to_ogg_out_${Date.now()}.ogg`)

    try {
        if (!fs.existsSync('/tmp')) fs.mkdirSync('/tmp', { recursive: true })
        fs.writeFileSync(tempIn, inputBuffer)

        await new Promise((resolve, reject) => {
            ffmpeg(tempIn)
                .toFormat('opus')
                .outputOptions([
                    '-acodec libopus',
                    '-ac 1',
                    '-ar 48000'
                ])
                .on('end', resolve)
                .on('error', reject)
                .save(tempOut)
        })

        const outputBuffer = fs.readFileSync(tempOut)
        return outputBuffer
    } finally {
        if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn)
        if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut)
    }
}

// Send Voice (PTT)
server.post('/api/sendVoice', async (req: any, reply) => {
    const { sessionId, chatId, file, replyTo } = req.body
    const session = sessions.get(sessionId || 'default')
    if (!session) return reply.code(404).send({ error: 'Session not found' })

    const jid = chatId.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`

    try {
        let buffer = Buffer.from(file.data, 'base64')
        const isWav = file.mimetype?.includes('wav') || file.filename?.endsWith('.wav')

        // Always convert to OGG/OPUS for WhatsApp PTT to be safe and ensure it's rendered as a voice note
        server.log.info({ sessionId, chatId }, 'Converting outgoing voice to OGG/OPUS...')
        buffer = (await convertToOggOpus(buffer)) as any

        await session.sock.sendMessage(jid, {
            audio: buffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
        }, { quoted: replyTo ? { key: { id: replyTo } } : undefined })

        return { success: true }
    } catch (e: any) {
        server.log.error({ error: e.message }, 'Failed to send voice')
        return reply.code(500).send({ error: e.message })
    }
})

// Send Image
server.post('/api/sendImage', async (req: any, reply) => {
    const { sessionId, chatId, file, caption, replyTo } = req.body
    const session = sessions.get(sessionId || 'default')
    if (!session) return reply.code(404).send({ error: 'Session not found' })

    const jid = chatId.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`

    try {
        const buffer = Buffer.from(file.data, 'base64')
        await session.sock.sendMessage(jid, {
            image: buffer,
            caption: caption,
            mimetype: file.mimetype || 'image/jpeg'
        }, { quoted: replyTo ? { key: { id: replyTo } } : undefined })

        return { success: true }
    } catch (e: any) {
        return reply.code(500).send({ error: e.message })
    }
})

// Send Video
server.post('/api/sendVideo', async (req: any, reply) => {
    const { sessionId, chatId, file, caption, replyTo } = req.body
    const session = sessions.get(sessionId || 'default')
    if (!session) return reply.code(404).send({ error: 'Session not found' })

    const jid = chatId.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`

    try {
        const buffer = Buffer.from(file.data, 'base64')
        await session.sock.sendMessage(jid, {
            video: buffer,
            caption: caption,
            mimetype: file.mimetype || 'video/mp4'
        }, { quoted: replyTo ? { key: { id: replyTo } } : undefined })

        return { success: true }
    } catch (e: any) {
        return reply.code(500).send({ error: e.message })
    }
})

// Send File (Generic Document)
server.post('/api/sendFile', async (req: any, reply) => {
    const { sessionId, chatId, file, caption, replyTo } = req.body
    const session = sessions.get(sessionId || 'default')
    if (!session) return reply.code(404).send({ error: 'Session not found' })

    const jid = chatId.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`

    try {
        const buffer = Buffer.from(file.data, 'base64')
        await session.sock.sendMessage(jid, {
            document: buffer,
            caption: caption,
            mimetype: file.mimetype || 'application/octet-stream',
            fileName: file.filename || 'file'
        }, { quoted: replyTo ? { key: { id: replyTo } } : undefined })

        return { success: true }
    } catch (e: any) {
        return reply.code(500).send({ error: e.message })
    }
})

// Download Media from Cached Message
server.get('/api/messages/:messageId/media', async (req: any, reply) => {
    const { messageId } = req.params
    const sessionIdParam = req.query.sessionId as string | undefined

    server.log.info({ messageId, sessionIdParam }, 'Media download request')

    // Find the message in session caches
    let targetSession: SessionData | undefined
    let cachedMessage: WAMessage | undefined

    if (sessionIdParam) {
        targetSession = sessions.get(sessionIdParam)
        cachedMessage = targetSession?.messageCache.get(messageId)
    } else {
        // Search all sessions
        for (const [id, session] of sessions) {
            const msg = session.messageCache.get(messageId)
            if (msg) {
                targetSession = session
                cachedMessage = msg
                server.log.info({ messageId, foundInSession: id }, 'Message found in cache')
                break
            }
        }
    }

    if (!cachedMessage || !targetSession) {
        server.log.warn({ messageId }, 'Message not found in any session cache')
        return reply.code(404).send({ error: 'Message not found in cache. It may have expired (5min TTL).' })
    }

    try {
        // Use Baileys' downloadMediaMessage utility
        const buffer = await downloadMediaMessage(
            cachedMessage,
            'buffer',
            {},
            {
                logger: pino({ level: 'silent' }) as any,
                reuploadRequest: targetSession.sock.updateMediaMessage
            }
        )

        // Determine mimetype from message
        const msg = cachedMessage.message
        let mimetype = 'application/octet-stream'
        if (msg?.audioMessage) mimetype = msg.audioMessage.mimetype || 'audio/ogg; codecs=opus'
        if (msg?.imageMessage) mimetype = msg.imageMessage.mimetype || 'image/jpeg'
        if (msg?.videoMessage) mimetype = msg.videoMessage.mimetype || 'video/mp4'
        if (msg?.documentMessage) mimetype = msg.documentMessage.mimetype || 'application/octet-stream'
        if (msg?.stickerMessage) mimetype = 'image/webp'

        server.log.info({ messageId, mimetype, size: (buffer as Buffer).length }, 'Media downloaded successfully')

        // Handle WAV conversion if requested
        if (req.query.format === 'wav' && mimetype.startsWith('audio/')) {
            server.log.info({ messageId }, 'Converting audio to WAV...')
            try {
                const wavBuffer = await convertToWav(buffer as Buffer)
                server.log.info({ messageId, originalSize: (buffer as Buffer).length, wavSize: wavBuffer.length }, 'Converted to WAV successfully')
                reply.header('Content-Type', 'audio/wav')
                return reply.send(wavBuffer)
            } catch (convErr: any) {
                server.log.error({ messageId, error: convErr.message }, 'WAV conversion failed, falling back to original')
            }
        }

        reply.header('Content-Type', mimetype)
        return reply.send(buffer)

    } catch (e: any) {
        server.log.error({ messageId, error: e.message, stack: e.stack }, 'Media download failed')
        return reply.code(500).send({ error: 'Failed to download media: ' + e.message })
    }
})

// Admin Action
server.post('/api/admin/action', async (req: any, reply) => {
    const { action, sessionId } = req.body
    server.log.info({ action, sessionId }, 'Admin Action Request')

    // Some actions might be global, others session specific

    if (action === 'restart') {
        setTimeout(() => {
            process.exit(0) // Docker will restart
        }, 1000)
        return { success: true, message: 'Restarting container...' }
    }

    return { success: true }
})

// --- STARTUP ---
server.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
    if (err) {
        console.error(err)
        process.exit(1)
    }
    console.log(`Baileys Multi-Session Service listening on ${address}`)

    // Auto-start only sessions that have valid credentials (were previously authenticated)
    // Sessions without creds.json are waiting for QR scan - don't auto-start them
    try {
        const dirs = fs.readdirSync(BASE_AUTH_DIR)
        dirs.forEach(dir => {
            if (dir.startsWith('session_')) {
                const id = dir.replace('session_', '')
                const credsPath = path.join(BASE_AUTH_DIR, dir, 'creds.json')

                // Only auto-start if credentials exist (session was previously authenticated)
                if (fs.existsSync(credsPath)) {
                    console.log(`Auto-starting authenticated session: ${id}`)
                    startSession(id)
                } else {
                    console.log(`Skipping unauthenticated session: ${id} (no creds.json - needs manual start)`)
                }
            }
        })
    } catch (e) {
        console.error('Failed to auto-start sessions', e)
    }

    // Periodic health check - auto-repair every 5 minutes if issues detected
    setInterval(async () => {
        for (const [sessionId, session] of sessions) {
            // Skip if already repairing or not connected
            if (session.isRepairing || session.status !== 'CONNECTED') continue

            // Check if session has accumulated errors
            if (session.decryptErrors > 3 || session.badMacCount > 3) {
                console.log(`[AutoRepair] Session ${sessionId} has ${session.decryptErrors} decrypt errors, ${session.badMacCount} Bad MAC errors. Auto-repairing...`)
                try {
                    await repairSession(sessionId)
                } catch (e) {
                    console.error(`[AutoRepair] Failed to repair session ${sessionId}:`, e)
                }
            }
        }
    }, 5 * 60 * 1000) // Every 5 minutes
})
