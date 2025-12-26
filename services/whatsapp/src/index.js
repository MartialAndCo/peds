const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3001;

// Config
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/whatsapp';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'secret'; // Simple security

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth Middleware
const authenticate = (req, res, next) => {
    const token = req.headers['x-api-key'];
    if (token !== AUTH_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Initialize Client
// Puppeteer args for running in Docker/EC2
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        executablePath: process.env.CHROME_BIN || undefined
    }
});

let qrCodeData = null;
let status = 'INITIALIZING';

client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, { small: true });
    qrCodeData = qr;
    status = 'SCAN_QR_CODE';
});

client.on('ready', () => {
    console.log('Client is ready!');
    status = 'CONNECTED';
    qrCodeData = null;
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
    status = 'AUTHENTICATED';
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
    status = 'AUTH_FAILURE';
});

client.on('disconnected', (reason) => {
    console.log('Client was disconnected', reason);
    status = 'DISCONNECTED';
});

// Incoming Messages
client.on('message', async msg => {
    console.log('MESSAGE RECEIVED', msg.from);
    try {
        // Resolve Real Contact (Handle LIDs)
        const contact = await msg.getContact();

        // Force construction of @c.us ID from the phone number attribute if available
        let realFrom = contact.id._serialized;
        if (contact.number) {
            realFrom = `${contact.number}@c.us`;
        }

        const realName = contact.name || contact.pushname || msg._data.notifyName;

        console.log(`[Incoming] ${msg.from} RESOLVED TO ${realFrom} (${realName})`);

        // Forward to Webhook
        const payload = {
            event: 'message',
            payload: {
                id: msg.id._serialized,
                from: realFrom, // <--- GUARANTEED @c.us
                body: msg.body,
                fromMe: msg.fromMe,
                _data: {
                    notifyName: realName,
                    mimetype: msg._data.mimetype
                },
                type: msg.type,
                timestamp: msg.timestamp
            }
        };

        // If message has media, we might want to download it later or send metadata
        // For now, Next.js calls back to download, but we should probably push it?
        // WAHA style: Next.js calls GET /api/messages/:id/media
        // Let's implement that endpoint below.

        await axios.post(WEBHOOK_URL, payload);
    } catch (e) {
        console.error('Webhook failed', e.message);
        if (e.response && e.response.data) {
            console.error('Webhook Error Details:', JSON.stringify(e.response.data, null, 2));
        }
    }
});


// --- API Routes ---

app.get('/status', (req, res) => {
    res.json({ status, qr: qrCodeData });
});

// Helper: Sanitize ID
const sanitizeId = (id) => {
    if (!id) return id;
    // If it has a suffix (@c.us or @g.us), just remove +, spaces, dashes, parens
    if (id.includes('@')) {
        return id.replace(/[+\s\-()]/g, '');
    }
    // If it's just a number, remove non-digits and append @c.us
    return id.replace(/\D/g, '') + '@c.us';
};

// Send Text
app.post('/api/sendText', authenticate, async (req, res) => {
    let { chatId, text } = req.body;
    try {
        const originalId = chatId;
        chatId = sanitizeId(chatId);
        console.log(`[SendText] '${text.substring(0, 20)}...' TO: ${chatId} (Original: ${originalId})`);

        await client.sendMessage(chatId, text);
        console.log(`[SendText] SUCCESS`);
        res.json({ success: true });
    } catch (e) {
        console.error(`[SendText] FAILED to ${chatId}`, e);
        res.status(500).json({ error: e.message });
    }
});

// Send Voice (Base64)
// Send Voice (Base64)
app.post('/api/sendVoice', authenticate, async (req, res) => {
    let { chatId, file } = req.body; // file: { mimetype, data (base64), filename }
    try {
        chatId = sanitizeId(chatId);
        const media = new MessageMedia(file.mimetype, file.data, file.filename);

        // sendAudioAsVoice: true is the magic flag for PTT
        await client.sendMessage(chatId, media, { sendAudioAsVoice: true });

        res.json({ success: true });
    } catch (e) {
        console.error('Send Voice Error', e);
        res.status(500).json({ error: e.message });
    }
});

// Send File/Image
// Send File/Image
app.post('/api/sendFile', authenticate, async (req, res) => {
    let { chatId, file, caption } = req.body;
    try {
        chatId = sanitizeId(chatId);
        const media = new MessageMedia(file.mimetype, file.data, file.filename);
        await client.sendMessage(chatId, media, { caption });
        res.json({ success: true });
    } catch (e) {
        console.error('Send File Error', e);
        res.status(500).json({ error: e.message });
    }
});

// Mark as Seen
// Mark as Seen
app.post('/api/markSeen', authenticate, async (req, res) => {
    let { chatId } = req.body;
    try {
        chatId = sanitizeId(chatId);
        const chat = await client.getChatById(chatId);
        await chat.sendSeen();
        res.json({ success: true });
    } catch (e) {
        console.error('Mark Seen Error', e);
        res.status(500).json({ error: e.message });
    }
});

// Typing State (true = typing, false = stop)
// Typing State (true = typing, false = stop)
app.post('/api/sendStateTyping', authenticate, async (req, res) => {
    let { chatId, isTyping } = req.body;
    try {
        chatId = sanitizeId(chatId);
        const chat = await client.getChatById(chatId);
        if (isTyping) {
            await chat.sendStateTyping();
        } else {
            await chat.clearState();
        }
        res.json({ success: true });
    } catch (e) {
        console.error('Typing State Error', e);
        res.status(500).json({ error: e.message });
    }
});

// Get Media (to mimic WAHA for voice download)
// /api/:session/chats/:chatId/messages/:messageId
// Simplified to /api/messages/:msgId/media
// But user app tries to construct WAHA url.
// We should match waha path or update user app.
// Let's UPDATE USER APP to point to this new simple API.
// New Endpoint: GET /api/messages/:msgId/media
app.get('/api/messages/:msgId/media', authenticate, async (req, res) => {
    const { msgId } = req.params;
    try {
        const msg = await client.getMessageById(msgId);
        if (!msg) {
            return res.status(404).json({ error: 'Message not found' });
        }
        if (!msg.hasMedia) {
            return res.status(400).json({ error: 'Message has no media' });
        }

        const media = await msg.downloadMedia();
        if (!media) {
            return res.status(500).json({ error: 'Failed to download media' });
        }

        // Return raw buffer with content-type
        const buffer = Buffer.from(media.data, 'base64');
        res.setHeader('Content-Type', media.mimetype);
        res.send(buffer);

    } catch (e) {
        console.error('Download Media Error', e);
        res.status(500).json({ error: e.message });
    }
});


// Start
client.initialize();

app.listen(port, () => {
    console.log(`WhatsApp Service listening on port ${port}`);
});
