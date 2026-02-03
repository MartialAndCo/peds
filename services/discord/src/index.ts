import { Client } from 'discord.js-selfbot-v13';
import fastify from 'fastify';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3002; // Different port from Baileys
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (!DISCORD_TOKEN) {
    console.error('FATAL: DISCORD_TOKEN is not defined.');
    process.exit(1);
}

// --- Discord Client Setup ---
const client = new Client();

const server = fastify({ logger: true });

// --- Event Handlers ---

client.on('ready', async () => {
    console.log(`[Discord] Logged in as ${client.user?.tag} (${client.user?.id})!`);
});

client.on('messageCreate', async (message) => {
    // 1. Ignore own messages
    if (message.author.id === client.user?.id) return;

    // 2. Only handle DMs (Direct Messages) for now
    if (message.channel.type !== 'DM') return;

    console.log(`[Discord] Received DM from ${message.author.tag}: ${message.content}`);

    if (!WEBHOOK_URL) {
        console.warn('[Discord] No WEBHOOK_URL configured, skipping forward.');
        return;
    }

    try {
        // Prepare payload for Director (matching Baileys format roughly)
        const payload = {
            sessionId: 'discord_default', // Single session for now
            event: 'message',
            payload: {
                id: message.id,
                from: message.author.id, // Discord ID
                body: message.content,
                fromMe: false,
                type: 'chat',
                platform: 'discord', // Explicitly mark as discord
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

        // Mark as read (simulate human behavior)
        // await message.channel.sendTyping(); // Optional: trigger typing

    } catch (error: any) {
        console.error('[Discord] Failed to forward message:', error.message);
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

        // Send Message
        await user.send(text);

        console.log(`[Discord] Sent message to ${user.tag}`);
        return { success: true };

    } catch (error: any) {
        console.error('[Discord] Failed to send message:', error);
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
        console.log(`[Discord] API listening on port ${PORT}`);

        await client.login(DISCORD_TOKEN);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
