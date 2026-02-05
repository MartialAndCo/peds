import {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WAMessage,
    downloadMediaMessage,
    jidNormalizedUser
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
process.on('unhandledRejection', (reason: any, promise) => {
    // Filter known harmless errors during repair
    if (reason?.message?.includes('Connection Closed')) {
        console.log('[IGNORE] Connection closed during operation - expected during repair')
        return
    }
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
    sessionStartTime: number
}

// Map<agentId, SessionData>
const sessions = new Map<string, SessionData>()
// Map<JID, SessionId> - Prevents double connection of same credentials
const activeIdentities = new Map<string, string>()

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
    // Exempt health checks and log endpoints
    const exemptPaths = ['/status', '/api/status', '/health', '/api/logs/ingest', '/api/docker-logs']
    if (exemptPaths.includes(urlPath)) return

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

/**
 * Helper to get Buffer from file object (base64 data OR url)
 */
async function getBufferFromFile(file: any): Promise<Buffer> {
    server.log.info({ fileKeys: file ? Object.keys(file) : 'FILE_IS_UNDEFINED' }, '[getBufferFromFile] Received file object')

    if (!file) {
        throw new Error('File object is undefined or null')
    }

    if (file.data) {
        server.log.info({ dataLength: file.data.length }, '[getBufferFromFile] Using base64 data')
        return Buffer.from(file.data, 'base64')
    }

    if (file.url) {
        server.log.info({ url: file.url }, '[getBufferFromFile] Downloading from URL...')
        try {
            const res = await axios.get(file.url, { responseType: 'arraybuffer', timeout: 30000 })
            server.log.info({ status: res.status, dataSize: res.data?.length || 0 }, '[getBufferFromFile] Download response')

            if (!res.data) {
                throw new Error('URL download returned empty data')
            }

            const buffer = Buffer.from(res.data)
            server.log.info({ bufferSize: buffer.length }, '[getBufferFromFile] Buffer created successfully')
            return buffer
        } catch (downloadErr: any) {
            server.log.error({ url: file.url, error: downloadErr.message, code: downloadErr.code }, '[getBufferFromFile] URL download FAILED')
            throw new Error(`Failed to download from URL: ${downloadErr.message}`)
        }
    }

    throw new Error('File payload must contain "data" (base64) or "url"')
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

        // KEEP app-state-sync files (removing them can cause more issues)
        if (file.startsWith('app-state-sync')) {
            kept.push(file)
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

    // Check cooldown (minimum 10 seconds between repairs)
    const now = Date.now()
    if (session && (now - session.lastRepairTime) < 10000) {
        const waitTime = Math.ceil((10000 - (now - session.lastRepairTime)) / 1000)
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
            newSession.lastRepairTime = now // Persist repair time for grace period check
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

    // --- 🛡️ CONFLICT PROTECTION: Prevent Double Connection ---
    if (state.creds.me?.id) {
        const myJid = jidNormalizedUser(state.creds.me.id)
        if (activeIdentities.has(myJid)) {
            const conflictSession = activeIdentities.get(myJid)
            if (conflictSession !== sessionId) {
                server.log.error({ sessionId, myJid, conflictSession }, '🚨 CRITICAL: Identity ALREADY ACTIVE on another session. Aborting start to prevent ban.')
                // Do not return a session object, effectively skipping start
                return null
            }
        }
        // Register intent
        activeIdentities.set(myJid, sessionId)
    }
    // -----------------------------------------------------
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
        isRepairing: false,
        sessionStartTime: Date.now() // Track when session started for grace period
    }

    sessions.set(sessionId, sessionData)

    sock.ev.on('creds.update', (creds) => {
        saveCreds()
        if (creds.me?.id) {
            const jid = jidNormalizedUser(creds.me.id)
            // Just ensure it's registered to us
            activeIdentities.set(jid, sessionId)
        }
    })

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

            // Unregister identity to allow reconnection
            for (const [jid, sId] of activeIdentities.entries()) {
                if (sId === sessionId) activeIdentities.delete(jid)
            }

            sessions.delete(sessionId)
            clearInterval(storeInterval)

            // Note: We don't clear the interval here because it's defined inside startSession but not stored on sessionData
            // However, it's scoped to this closure, so it's tricky.
            // In the original code, storeInterval IS cleared. I must have missed re-implementing it here.

            // Only auto-reconnect if:
            // 1. Not logged out
            // 2. Session was previously connected (authenticated) OR it's not a QR timeout
            // 3. SPECIAL CASE: Error 515 (Stream Errored) requires restart even if not fully connected yet
            const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515
            const shouldReconnect = !wasLoggedOut && (wasConnected || !wasQrTimeout || isRestartRequired)

            if (shouldReconnect && (wasConnected || isRestartRequired)) {
                server.log.info({ sessionId, statusCode, isRestartRequired }, 'Auto-reconnecting (Authenticated or 515)...')
                const delay = isRestartRequired ? 2000 : 5000 // Fast restart for 515
                setTimeout(() => startSession(sessionId), delay)
            } else if (wasQrTimeout && !wasConnected) {
                server.log.info({ sessionId }, 'QR timeout - waiting for manual restart (user never scanned)')
            } else if (wasLoggedOut) {
                if (!wasConnected) {
                    // Startup Failure: Often a conflict or temporary auth issue
                    server.log.warn({ sessionId, statusCode }, 'Startup 401 (Never connected). Marking as DISCONNECTED (Data preserved).')
                } else {
                    // Runtime Failure: Genuine logout or conflict
                    server.log.error({ sessionId, statusCode }, 'Session logged out during runtime. Manual intervention required (Scan/Restart). Data preserved.')
                }
            }
        } else if (connection === 'open') {
            sessionData.status = 'CONNECTED'
            sessionData.qr = null
            sessionData.wasConnected = true // Mark as successfully authenticated
            sessionData.isRepairing = false
            sessionData.decryptErrors = 0 // Reset error counters
            sessionData.badMacCount = 0

            // Confirm identity registration & Notify App (Self-Healing Mapping)
            if (sock.user?.id) {
                const jid = jidNormalizedUser(sock.user.id)
                activeIdentities.set(jid, sessionId)

                // Ping Webhook so app knows which JID belongs to this sessionId
                if (WEBHOOK_URL) {
                    const statusPayload = {
                        sessionId,
                        event: 'session.status',
                        payload: {
                            status: 'CONNECTED',
                            jid,
                            phoneNumber: jid.split('@')[0]
                        }
                    }
                    axios.post(WEBHOOK_URL, statusPayload, {
                        headers: { 'x-internal-secret': WEBHOOK_SECRET || '' }
                    }).catch(e => {
                        // Silent catch for logger issues
                    })
                }
            }

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
                    const now = Date.now()
                    // GRACE PERIOD: Ignore errors if we just repaired recently (e.g. within 20s)
                    if (now - sessionData.lastRepairTime < 60000) { // 60s grace period for key resync
                        server.log.warn({ sessionId, timeSinceRepair: now - sessionData.lastRepairTime }, 'Ignoring decrypt error during post-repair grace period')
                        return
                    }

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

            // --- STRICT SPAM PROTECTION ---
            // 1. Ignore "fromMe" (Sent by Bot) - prevents self-loops and self-contact creation
            if (msg.key.fromMe) {
                server.log.info({ sessionId, msgId: msg.key.id }, 'Ignoring "fromMe" message')
                return
            }

            // 2. Startup Grace Period (5 seconds) - Ignore backlog flood on connection
            const sessionAgeMs = Date.now() - sessionData.sessionStartTime
            if (sessionAgeMs < 5000) {
                server.log.info({ sessionId, msgId: msg.key.id, sessionAgeMs }, 'Ignoring message during startup grace period (preventing flood)')
                return
            }

            // 3. Strict Timestamp Check (10 seconds max) - Ignore historical messages
            if (msgAgeSeconds > 10) {
                server.log.info({ sessionId, msgId: msg.key.id, ageSeconds: msgAgeSeconds }, 'Ignoring stale message (older than 10s)')
                return
            }
            // -----------------------------

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

    // Listen for Call Events
    sock.ev.on('call', async (calls: any) => {
        if (!WEBHOOK_URL) return
        for (const call of calls) {
            server.log.info({ sessionId, callId: call.id, status: call.status, from: call.from }, 'Call event received')
            try {
                const payload = {
                    sessionId,
                    event: 'call',
                    payload: {
                        id: call.id,
                        from: call.from,
                        status: call.status, // offer, timeout, reject, accept, terminate
                        timestamp: call.date,
                        isVideo: call.isVideo,
                        isGroup: call.isGroup
                    }
                }
                await axios.post(WEBHOOK_URL, payload, { headers: { 'x-internal-secret': WEBHOOK_SECRET || '' } })
            } catch (e: any) {
                server.log.error({ sessionId, err: e.message }, 'Failed to forward call event')
            }
        }
    })

    // Listen for Reactions (for payment claim confirmation)
    sock.ev.on('messages.reaction', async (reactions: any[]) => {
        if (!WEBHOOK_URL) return

        for (const reaction of reactions) {
            try {
                server.log.info({ sessionId, reaction }, 'Reaction event received')

                const payload = {
                    sessionId,
                    event: 'message.reaction',
                    payload: {
                        key: reaction.key,
                        messageId: reaction.key?.id,
                        reaction: {
                            text: reaction.reaction?.text,
                            key: reaction.reaction?.key
                        },
                        fromMe: reaction.key?.fromMe
                    }
                }

                const response = await axios.post(WEBHOOK_URL, payload, {
                    headers: { 'x-internal-secret': WEBHOOK_SECRET || '' }
                })
                server.log.info({ sessionId, status: response.status }, 'Reaction webhook sent')

            } catch (e: any) {
                server.log.error({ sessionId, err: e.message }, 'Reaction webhook FAILED')
            }
        }
    })

    // Listen for Message Status Updates (Read Receipts / Delivery)
    sock.ev.on('messages.update', async (updates: any[]) => {
        if (!WEBHOOK_URL) return

        for (const update of updates) {
            try {
                // We only care about status updates (READ, DELIVERY_ACK, etc)
                if (!update.update.status) continue

                server.log.info({ sessionId, update }, 'Message Status Update received')

                // Map Baileys status to our status
                // 3 = READ, 2 = DELIVERED_SERVER/DEVICE
                let status = 'UNKNOWN'
                if (update.update.status === 3) status = 'READ'
                else if (update.update.status >= 2) status = 'DELIVERED'

                const payload = {
                    sessionId,
                    event: 'message.update',
                    payload: {
                        key: update.key,
                        id: update.key.id,
                        fromMe: update.key.fromMe,
                        remoteJid: update.key.remoteJid,
                        status: status,
                        rawStatus: update.update.status
                    }
                }

                const response = await axios.post(WEBHOOK_URL, payload, {
                    headers: { 'x-internal-secret': WEBHOOK_SECRET || '' }
                })
                server.log.info({ sessionId, status: response.status, msgId: update.key.id, newStatus: status }, 'Status Update webhook sent')

            } catch (e: any) {
                server.log.error({ sessionId, err: e.message }, 'Status Update webhook FAILED')
            }
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

// Proactive Session Maintenance - Cleans old per-contact session files
server.post('/api/sessions/:sessionId/maintenance', async (req: any, reply) => {
    const { sessionId } = req.params
    const { maxAgeDays } = req.body || {}
    const maxAge = (maxAgeDays || 7) * 24 * 60 * 60 * 1000 // Default 7 days

    server.log.info({ sessionId, maxAgeDays: maxAgeDays || 7 }, 'Running proactive session maintenance')

    const authPath = path.join(BASE_AUTH_DIR, `session_${sessionId}`)
    if (!fs.existsSync(authPath)) {
        return reply.code(404).send({ error: 'Session folder not found' })
    }

    const now = Date.now()
    const cleaned: string[] = []
    const kept: string[] = []

    try {
        const files = fs.readdirSync(authPath)

        for (const file of files) {
            const filePath = path.join(authPath, file)
            const stat = fs.statSync(filePath)

            // Keep essential files: creds.json, store.json
            if (file === 'creds.json' || file === 'store.json') {
                kept.push(file)
                continue
            }

            // Check age of session-*.json files (per-contact encryption keys)
            if (file.startsWith('session-')) {
                const fileAge = now - stat.mtimeMs
                if (fileAge > maxAge) {
                    fs.unlinkSync(filePath)
                    cleaned.push(file)
                    server.log.info({ sessionId, file, ageDays: Math.floor(fileAge / (24 * 60 * 60 * 1000)) }, 'Cleaned old session file')
                } else {
                    kept.push(file)
                }
                continue
            }

            // Clean old pre-key files (>7 days)
            if (file.startsWith('pre-key-')) {
                const fileAge = now - stat.mtimeMs
                if (fileAge > maxAge) {
                    fs.unlinkSync(filePath)
                    cleaned.push(file)
                }
                continue
            }

            kept.push(file)
        }

        server.log.info({ sessionId, cleaned: cleaned.length, kept: kept.length }, 'Maintenance complete')

        return {
            success: true,
            cleaned: cleaned.length,
            kept: kept.length,
            cleanedFiles: cleaned.slice(0, 20), // Limit response size
            message: `Cleaned ${cleaned.length} old files`
        }
    } catch (e: any) {
        server.log.error({ sessionId, err: e.message }, 'Maintenance failed')
        return reply.code(500).send({ error: e.message })
    }
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

// Send Reaction (Like/Heart/Emoji)
server.post('/api/sendReaction', async (req: any, reply) => {
    const { sessionId, chatId, messageId, emoji } = req.body

    let targetSessionId = sessionId
    if (!targetSessionId) {
        if (sessions.size === 1) targetSessionId = sessions.keys().next().value
        else if (sessions.has('default')) targetSessionId = 'default'
    }

    const session = sessions.get(targetSessionId)
    if (!session) return reply.code(404).send({ error: 'Session not found', targetSessionId })

    const jid = chatId.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`

    try {
        // Baileys sendMessage with react type
        await session.sock.sendMessage(jid, {
            react: {
                text: emoji, // Empty string removes reaction
                key: {
                    remoteJid: jid,
                    id: messageId,
                    fromMe: false
                }
            }
        })
        server.log.info({ sessionId: targetSessionId, chatId, messageId, emoji }, 'Reaction sent')
        return { success: true }
    } catch (e: any) {
        server.log.error({ err: e, sessionId: targetSessionId, chatId }, 'Failed to send reaction')
        return reply.code(500).send({ error: e.message })
    }
})

// Mark as Read/Seen
server.post('/api/markSeen', async (req: any, reply) => {
    const { sessionId, chatId, messageId, messageKey, all } = req.body
    const session = sessions.get(sessionId || 'default')
    if (!session) return reply.code(404).send({ error: 'Session not found' })

    const jid = chatId?.includes('@') ? chatId.replace('@c.us', '@s.whatsapp.net') : `${chatId}@s.whatsapp.net`

    try {
        const keysToRead: any[] = []

        // 1. If explicit messageKey is provided, use it
        if (messageKey && messageKey.remoteJid && messageKey.id) {
            keysToRead.push(messageKey)
        }

        // 2. If all=true, collect ALL messages for this JID from cache
        if (all) {
            for (const msg of session.messageCache.values()) {
                if (msg.key.remoteJid === jid && !msg.key.fromMe) {
                    keysToRead.push(msg.key)
                }
            }
        }

        // 3. Fallback: if we have nothing, try to find the latest
        if (keysToRead.length === 0) {
            let latestKey = null
            let latestTimestamp = 0
            for (const msg of session.messageCache.values()) {
                if (msg.key.remoteJid === jid && !msg.key.fromMe) {
                    const ts = Number(msg.messageTimestamp)
                    if (ts > latestTimestamp) {
                        latestTimestamp = ts
                        latestKey = msg.key
                    }
                }
            }
            if (latestKey) keysToRead.push(latestKey)
        }

        // 4. Ultimate fallback: manual key construction if messageId exists
        if (keysToRead.length === 0 && messageId) {
            keysToRead.push({
                remoteJid: jid,
                id: messageId,
                fromMe: false
            })
        }

        if (keysToRead.length > 0) {
            // Deduplicate keys by ID
            const uniqueKeys = Array.from(new Map(keysToRead.map(k => [k.id, k])).values())
            await session.sock.readMessages(uniqueKeys)
            server.log.info({ sessionId, jid, count: uniqueKeys.length }, 'Marked messages as read (all/latest)')
            return { success: true, count: uniqueKeys.length }
        }

        return { success: true, count: 0, method: 'none_found' }
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
        let buffer = await getBufferFromFile(file)
        const isWav = file.mimetype?.includes('wav') || file.filename?.endsWith('.wav')

        // Always convert to OGG/OPUS for WhatsApp PTT to be safe and ensure it's rendered as a voice note
        server.log.info({ sessionId, chatId }, 'Converting outgoing voice to OGG/OPUS...')
        buffer = (await convertToOggOpus(buffer)) as any

        // Handle Quoting Safely
        let quotedMsg: any = undefined
        if (replyTo) {
            // 1. Try Cache
            quotedMsg = session.messageCache.get(replyTo)
            // 2. Try Store (if available)
            if (!quotedMsg && session.store) {
                try {
                    const loaded = await session.store.loadMessage(jid, replyTo)
                    if (loaded) quotedMsg = loaded
                } catch (e) { /* ignore store load error */ }
            }
            if (!quotedMsg) {
                server.log.warn({ sessionId, replyTo }, 'ReplyTo message not found in cache/store - sending without quote')
            }
        }

        await session.sock.sendMessage(jid, {
            audio: buffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
        }, { quoted: quotedMsg })

        return { success: true }
    } catch (e: any) {
        server.log.error({ error: e.message, stack: e.stack }, 'Failed to send voice')
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
        const buffer = await getBufferFromFile(file)
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
        const buffer = await getBufferFromFile(file)
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
        const buffer = await getBufferFromFile(file)
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

// Prune Zombie Sessions
server.post('/api/admin/prune', async (req: any, reply) => {
    try {
        const { keepIds } = req.body
        if (!Array.isArray(keepIds)) {
            return reply.code(400).send({ error: 'keepIds must be an array' })
        }

        server.log.info({ keepIds }, 'Pruning zombie sessions...')
        const dirs = fs.readdirSync(BASE_AUTH_DIR)
        const deleted: string[] = []
        const preserved: string[] = []

        for (const dir of dirs) {
            if (!dir.startsWith('session_')) continue
            const id = dir.replace('session_', '')

            // Keep if in allowed list OR if currently active in memory
            if (keepIds.includes(id) || sessions.has(id)) {
                preserved.push(dir)
                continue
            }

            // DELETE Zombie folder
            try {
                const folderPath = path.join(BASE_AUTH_DIR, dir)
                fs.rmSync(folderPath, { recursive: true, force: true })
                deleted.push(dir)
            } catch (err: any) {
                server.log.error({ dir, error: err.message }, 'Failed to delete zombie folder')
            }
        }

        return {
            success: true,
            deletedCount: deleted.length,
            deleted,
            preservedCount: preserved.length,
            preserved
        }
    } catch (e: any) {
        server.log.error(e, 'Prune failed')
        return reply.code(500).send({ error: e.message })
    }
})

// Docker Logs Endpoint - Récupère les logs des autres conteneurs
import { exec } from 'child_process'
import { promisify } from 'util'
const execAsync = promisify(exec)

server.get('/api/docker-logs', async (req: any, reply) => {
    const container = req.query.container as string || 'discord_bot'
    const lines = parseInt(req.query.lines as string) || 100
    
    // Liste des conteneurs autorisés (sécurité)
    const allowedContainers = ['discord_bot', 'nextjs_cron', 'baos']
    if (!allowedContainers.includes(container)) {
        return reply.code(400).send({ 
            error: 'Container not allowed',
            allowed: allowedContainers 
        })
    }

    try {
        // Récupérer les logs via docker logs
        const { stdout, stderr } = await execAsync(
            `docker logs --tail ${lines} --timestamps ${container} 2>&1`,
            { timeout: 10000 }
        )
        
        const logs = stdout || stderr || ''
        const logLines = logs.split('\n').filter(line => line.trim())
        
        return { 
            success: true, 
            container,
            lines: logLines,
            count: logLines.length,
            timestamp: new Date().toISOString()
        }
    } catch (e: any) {
        server.log.error({ container, error: e.message }, 'Failed to get docker logs')
        return reply.code(500).send({ 
            error: 'Failed to get logs',
            message: e.message,
            details: 'Make sure docker socket is accessible from this container'
        })
    }
})

// Admin Action
server.post('/api/admin/action', async (req: any, reply) => {
    const { action, sessionId } = req.body
    server.log.info({ action, sessionId }, 'Admin Action Request')

    // WIPE ALL SESSIONS (Factory Reset)
    if (action === 'wipe_all') {
        server.log.warn('🚨 DANGER: Wiping ALL session data and restarting...')

        try {
            const files = fs.readdirSync(BASE_AUTH_DIR)
            for (const file of files) {
                const filePath = path.join(BASE_AUTH_DIR, file)
                try {
                    fs.rmSync(filePath, { recursive: true, force: true })
                    server.log.info({ file }, 'Deleted session file/folder')
                } catch (err: any) {
                    server.log.error({ file, error: err.message }, 'Failed to delete file')
                }
            }

            // Force restart in 1 second to allow response to be sent
            setTimeout(() => {
                server.log.fatal('👋 Wiping complete. Exiting process to trigger Docker restart.')
                process.exit(0)
            }, 1000)

            return { success: true, message: 'All sessions wiped. Service restarting...' }
        } catch (e: any) {
            return reply.code(500).send({ error: e.message })
        }
    }

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
    const autoStart = async () => {
        try {
            const dirs = fs.readdirSync(BASE_AUTH_DIR)
            const sessionDirs = dirs.filter(dir => dir.startsWith('session_'))

            console.log(`[Startup] Found ${sessionDirs.length} potential sessions. Starting sequentially...`)

            for (const dir of sessionDirs) {
                const id = dir.replace('session_', '')
                const credsPath = path.join(BASE_AUTH_DIR, dir, 'creds.json')

                if (fs.existsSync(credsPath)) {
                    console.log(`[Startup] Auto-starting authenticated session: ${id}`)
                    try {
                        await startSession(id)
                    } catch (err: any) {
                        console.error(`[Startup] Failed to start session ${id}:`, err.message)
                    }
                } else {
                    console.log(`[Startup] Skipping unauthenticated session: ${id} (no creds.json - needs manual start)`)
                }
            }
            console.log('[Startup] All authenticated sessions processed.')
        } catch (e) {
            console.error('[Startup] Fatal error during session auto-start:', e)
        }
    }
    autoStart()

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

    // Proactive session maintenance - clean old session files every 6 hours
    setInterval(async () => {
        console.log('[Maintenance] Running proactive session cleanup...')
        for (const [sessionId, session] of sessions) {
            if (session.status !== 'CONNECTED') continue

            const authPath = path.join(BASE_AUTH_DIR, `session_${sessionId}`)
            if (!fs.existsSync(authPath)) continue

            const MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days
            const now = Date.now()
            let cleaned = 0

            try {
                const files = fs.readdirSync(authPath)
                for (const file of files) {
                    if (!file.startsWith('session-') && !file.startsWith('pre-key-')) continue
                    if (file === 'creds.json' || file === 'store.json') continue

                    const filePath = path.join(authPath, file)
                    const stat = fs.statSync(filePath)
                    const fileAge = now - stat.mtimeMs

                    if (fileAge > MAX_AGE) {
                        fs.unlinkSync(filePath)
                        cleaned++
                    }
                }
                if (cleaned > 0) {
                    console.log(`[Maintenance] Session ${sessionId}: Cleaned ${cleaned} old files`)
                }
            } catch (e) {
                console.error(`[Maintenance] Failed for ${sessionId}:`, e)
            }
        }
    }, 30 * 60 * 1000) // Every 30 minutes

    // Process incoming message queue - call Amplify CRON every 30 seconds
    setInterval(async () => {
        try {
            const webhookUrl = WEBHOOK_URL?.replace('/api/webhooks/whatsapp', '/api/cron/process-incoming')
            if (!webhookUrl) return

            const response = await axios.get(webhookUrl, {
                timeout: 60000, // 60s timeout for slow AI providers
                headers: { 'x-cron-source': 'baileys' }
            })

            if (response.data?.processed > 0) {
                console.log(`[CRON] Processed ${response.data.processed} incoming messages`)
            }
        } catch (e: any) {
            // Silent fail - it's just a CRON trigger
            if (e.code !== 'ECONNABORTED') {
                console.error('[CRON] Process-incoming failed:', e.message)
            }
        }
    }, 30 * 1000) // Every 30 seconds
})
