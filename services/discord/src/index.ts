
import { Client } from 'discord.js-selfbot-v13';
import fastify from 'fastify';
import axios from 'axios';
import dotenv from 'dotenv';
import debug from 'debug';

dotenv.config();

const logger = {
    info: debug('discord:info'),
    error: debug('discord:error'),
    warn: debug('discord:warn')
};

// Enable debug logs by default
debug.enable('discord:*');

const PORT = parseInt(process.env.PORT || '3002', 10);
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Extract base URL for API (remove /api/webhooks/discord)
const BASE_API_URL = WEBHOOK_URL?.replace('/api/webhooks/discord', '/api') || 'http://localhost:3000/api';

if (!DISCORD_TOKEN) {
    console.error('FATAL: DISCORD_TOKEN is not defined.');
    process.exit(1);
}

// --- Discord Client Setup ---
const client = new Client();
const server = fastify({ logger: true });

// --- Helper: Heartbeat ---
const sendHeartbeat = async () => {
    if (!client.user) return

    try {
        await axios.post(`${BASE_API_URL}/integrations/discord/heartbeat`, {
            botId: client.user.id,
            username: client.user.username
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': WEBHOOK_SECRET || ''
            }
        })
        logger.info(`Heartbeat sent for ${client.user.username} (${client.user.id})`)
    } catch (e: any) {
        logger.error(`Heartbeat failed: ${e.message}`)
    }
}

// --- Event Handlers ---

client.on('ready', async () => {
    logger.info(`Logged in as ${client.user?.tag} (${client.user?.id})!`);

    // Register immediately
    await sendHeartbeat();

    // Keep alive every minute
    setInterval(sendHeartbeat, 60 * 1000);
});

client.on('messageCreate', async (message) => {
    // 1. Ignore own messages
    if (message.author.id === client.user?.id) return;

    // 2. Only handle DMs (Direct Messages) for now
    if (message.channel.type !== 'DM') return;

    logger.info(`Received DM from ${message.author.tag}: ${message.content}`);

    if (!WEBHOOK_URL) {
        logger.warn('No WEBHOOK_URL configured, skipping forward.');
        return;
    }

    try {
        // Prepare payload for Director (matching Baileys format roughly)
        const payload = {
            sessionId: `discord_${client.user?.id}`, // Tag with Bot ID
            event: 'message',
            payload: {
                id: message.id,
                from: message.author.id, // Discord ID
                body: message.content,
                fromMe: false,
                type: 'chat',
                platform: 'discord',
                _data: {
                    notifyName: message.author.username,
                    discriminator: message.author.discriminator
                }
            }
        };

        // Forward to Director
        await axios.post(WEBHOOK_URL, payload, {
            headers: { 'x-internal-secret': WEBHOOK_SECRET || '' }
        });

    } catch (error: any) {
        logger.error('Failed to forward message:', error.message);
    }
});

// --- API Routes (For Director to Reply) ---

server.post('/api/sendText', async (req: any, reply) => {
    const { chatId, text } = req.body; // chatId will be Discord User ID

    if (!chatId || !text) {
        return reply.code(400).send({ error: 'Missing chatId or text' });
    }

    try {
        // Fetch user to open DM
        const user = await client.users.fetch(chatId);
        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }

        // Create DM Channel explicitly to simulate typing
        const channel = await user.createDM();

        // --- TYPING SIMULATION ---
        // Calculate delay: ~50ms per char, min 1s, max 10s
        const typingDuration = Math.min(Math.max(text.length * 50, 1000), 10000);

        logger.info(`Simulating typing for ${typingDuration}ms...`);
        channel.sendTyping(); // Trigger "User is typing..." indicator

        // Wait for the calculated duration
        await new Promise(resolve => setTimeout(resolve, typingDuration));
        // -------------------------

        // Send Message
        await channel.send(text);

        logger.info(`Sent message to ${user.tag}`);
        return { success: true };

    } catch (error: any) {
        logger.error('Failed to send message:', error);
        return reply.code(500).send({ error: error.message });
    }
});


server.get('/health', async (req, reply) => {
    return { status: 'ok', discord: client.isReady() ? 'connected' : 'disconnected' };
});

// --- Startup ---

const start = async () => {
    try {
        await server.listen({ port: PORT, host: '0.0.0.0' });
        logger.info(`API listening on port ${PORT}`);

        await client.login(DISCORD_TOKEN);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
