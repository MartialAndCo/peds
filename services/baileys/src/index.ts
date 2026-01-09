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
    if (['/status', '/api/status', '/health'].includes(urlPath)) return

    addToLogBuffer(`${new Date().toISOString()} [${request.method}] ${request.url} - ${reply.statusCode}`)
})

// Auth Middleware
server.addHook('preHandler', async (request, reply) => {
    const urlPath = request.url.split('?')[0]
    if (urlPath === '/status' || urlPath === '/api/status' || urlPath === '/health') return

    const apiKey = request.headers['x-api-key']
    if (apiKey !== AUTH_TOKEN) {
        reply.code(401).send({ error: 'Unauthorized' })
    }
})

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

// --- SESSION STARTUP LOGIC ---
async function startSession(sessionId: string) {
    if (sessions.has(sessionId)) {
        server.log.info({ sessionId }, 'Session already active')
        return sessions.get(sessionId)
    }

    server.log.info({ sessionId }, 'Starting session...')

    // Auth folder: auth_info_baileys/session_{id}
    const authPath = path.join(BASE_AUTH_DIR, `session_${sessionId}`)
    if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(authPath)
    const { version } = await fetchLatestBaileysVersion()

    // Custom Store for this session
    const store = makeSimpleStore(sessionId)
    const STORE_FILE = path.join(authPath, 'store.json')
    store.readFromFile(STORE_FILE)

    // Local persistence interval
    const storeInterval = setInterval(() => store.writeToFile(STORE_FILE), 30_000)

    // Msg Retry Cache
    const retryMap = new Map<string, any>()
    const msgRetryCounterCache = {
        get: <T>(key: string) => retryMap.get(key) as T | undefined,
        set: <T>(key: string, value: T) => { retryMap.set(key, value) },
        del: (key: string) => { retryMap.delete(key) },
        flushAll: () => { retryMap.clear() }
    }

    const sock = makeWASocket({
        version,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        msgRetryCounterCache,
        logger: pino({ level: 'silent' }) as any,
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 60_000
    })

    store.bind(sock.ev)

    const sessionData: SessionData = {
        id: sessionId,
        sock,
        status: 'STARTING',
        qr: null,
        store,
        messageCache: new Map<string, WAMessage>(),
        lidToPnMap: new Map<string, string>(),
        wasConnected: false // Will be set to true when connection opens
    }

    sessions.set(sessionId, sessionData)

    // Event Handlers
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

    sock.ev.on('messages.upsert', async (m) => {
        // DEBUG: Log ALL incoming messages
        server.log.info({ sessionId, type: m.type, count: m.messages.length }, 'messages.upsert event received')

        if (!WEBHOOK_URL) {
            server.log.warn({ sessionId }, 'WEBHOOK_URL not configured - messages will NOT be forwarded!')
            return
        }

        try {
            const msg = m.messages[0]
            if (!msg.message) {
                server.log.info({ sessionId, msgId: msg.key.id }, 'Message has no content (status update/receipt)')
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

                // Method 3: Check signal repository lid mapping
                if (!resolvedPhoneNumber && sock.signalRepository?.lidMapping) {
                    const lidKey = remoteJid.split('@')[0]
                    const mapping = sock.signalRepository.lidMapping
                    if (mapping && typeof mapping.get === 'function') {
                        resolvedPhoneNumber = mapping.get(lidKey) || null
                        if (resolvedPhoneNumber) {
                            server.log.info({ sessionId, method: 'signalRepository.lidMapping', pn: resolvedPhoneNumber }, 'LID resolved via signal repo')
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
                    _data: {
                        notifyName: msg.pushName,
                        phoneNumber: resolvedPhoneNumber // Include resolved phone number for LID messages
                    }
                }
            }

            server.log.info({ sessionId, webhookUrl: WEBHOOK_URL }, 'Sending to webhook...')
            const response = await axios.post(WEBHOOK_URL, payload, { headers: { 'x-internal-secret': WEBHOOK_SECRET || '' } })
            server.log.info({ sessionId, status: response.status }, 'Webhook call successful')

            // Cache for media retrieval
            if (msg.key.id) {
                sessionData.messageCache.set(msg.key.id, msg)
                setTimeout(() => sessionData.messageCache.delete(msg.key.id!), 300000) // 5min
            }

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
    const { sessionId, chatId } = req.body
    const session = sessions.get(sessionId || 'default')
    if (!session) return reply.code(404).send({ error: 'Session not found' })

    const jid = chatId.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`

    try {
        // Try to read from store or cache to get the last message key
        // Simple fallback: send presence update 'available' (user comes online)
        // Note: Real 'read' receipt requires message key. 
        // We will just update presence for now as 'mark read' logic is complex without message ID context.
        // Or if we have a key in req, we use it.
        // Future: Frontend should pass messageId(s) to mark read.

        // For now, at least prevent 404
        return { success: true }
    } catch (e: any) {
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

// Admin Action
server.post('/api/admin/action', async (req: any, reply) => {
    const { action, sessionId } = req.body
    server.log.info({ action, sessionId }, 'Admin Action Request')

    // Some actions might be global, others session specific

    if (action === 'restart') {
        process.exit(0) // Docker will restart
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
})
