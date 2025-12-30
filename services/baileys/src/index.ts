import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WAMessage
} from 'baileys'
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

const server = fastify({
    logger: { level: 'info' }
})

// Middleware for Auth
server.addHook('preHandler', async (request, reply) => {
    // Allow /status (used by lib/whatsapp.ts and health checks) and /api/status (legacy/standard)
    const allowedPaths = ['/status', '/api/status']
    // Fastify might strip trailing slash, checking plain match
    if (allowedPaths.includes(request.url.split('?')[0])) return

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
    })

    sock.ev.on('creds.update', saveCreds)

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
                connectToWhatsApp()
            }
        } else if (connection === 'open') {
            currentStatus = 'CONNECTED'
            currentQR = null
            server.log.info('Opened connection')
        }
    })

    // Webhook Logic
    sock.ev.on('messages.upsert', async (m: any) => {
        if (!WEBHOOK_URL) return

        try {
            const msg = m.messages[0]
            if (!msg.message) return // Protocol message?

            const from = msg.key.remoteJid
            const fromMe = msg.key.fromMe
            const senderName = msg.pushName || 'Unknown'

            // Determine body
            let body = ''
            if (msg.message.conversation) body = msg.message.conversation
            else if (msg.message.extendedTextMessage?.text) body = msg.message.extendedTextMessage.text
            else if (msg.message.imageMessage?.caption) body = msg.message.imageMessage.caption
            else if (msg.message.videoMessage?.caption) body = msg.message.videoMessage.caption

            // Determine mimetype/type for media
            let mimetype = null
            if (msg.message.imageMessage) mimetype = msg.message.imageMessage.mimetype
            else if (msg.message.videoMessage) mimetype = msg.message.videoMessage.mimetype
            else if (msg.message.audioMessage) mimetype = msg.message.audioMessage.mimetype

            // Construct WAHA-compatible Payload
            const payload = {
                event: 'message',
                payload: {
                    from: from,
                    body: body,
                    fromMe: fromMe,
                    _data: {
                        notifyName: senderName,
                        mimetype: mimetype
                    },
                    // Add raw message if needed for debug
                    // _raw: msg 
                }
            }

            await axios.post(WEBHOOK_URL, payload)
        } catch (err: any) {
            server.log.error(`Webhook failed: ${err.message}`)
        }
    })
}

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
