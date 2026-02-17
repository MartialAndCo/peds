
import { prisma } from './lib/prisma'
import { whatsapp } from './lib/whatsapp'
import { handleChat } from './lib/handlers/chat'

// --- MOCKS ---

// Mock Prisma
const mockPrisma = {
    conversation: {
        updateMany: async () => ({ count: 1 }), // Lock success
        update: async () => ({}),
        findFirst: async () => null
    },
    message: {
        create: async (args: any) => {
            console.log('[[VERIFICATION]] prisma.message.create called with:', JSON.stringify(args, null, 2))
            return { id: 123 }
        },
        findMany: async () => [],
        findFirst: async () => null,
        count: async () => 0
    },
    contact: {
        upsert: async () => ({ id: 999, status: 'active' }),
        update: async () => ({}),
        findUnique: async () => null,
        findFirst: async () => null // profile update check
    },
    messageQueue: {
        findMany: async () => []
    },
    media: {
        findMany: async () => []
    },
    agentProfile: {
        findUnique: async () => null
    }
}

// Override Prisma methods (Cast to any to force overwrite)
// @ts-ignore
Object.assign(prisma, mockPrisma)

// Verify Whatsapp import
if (!whatsapp) {
    console.error('Failed to import whatsapp module')
    process.exit(1)
}

// Mock WhatsApp
whatsapp.downloadMedia = async (messageId: string) => {
    console.log(`[[VERIFICATION]] SUCCESS: whatsapp.downloadMedia called for ${messageId}`)
    return {
        mimetype: 'image/webp',
        data: Buffer.from('fake-sticker-data')
    }
}

// Mock markAsRead to avoid errors
whatsapp.markAsRead = async () => { }
whatsapp.sendText = async () => { return { id: 'mock' } }

// --- TEST ---

async function run() {
    console.log('Starting Sticker Logic Verification...')

    const payload = {
        id: 'verification-sticker-id',
        type: 'sticker', // <--- THE NEW TYPE WE ADDED
        _data: { mimetype: 'image/webp' },
        timestamp: Math.floor(Date.now() / 1000),
        fromMe: false
    }

    const contact = {
        id: 999,
        phone_whatsapp: '+1234567890',
        status: 'active',
        testMode: false
    }

    const conversation = {
        id: 999,
        status: 'active',
        ai_enabled: true
    }

    const settings = {
        voice_source_number: '+0000000000'
    }

    try {
        console.log('Calling handleChat...')
        await handleChat(
            payload,
            contact,
            conversation,
            settings,
            '[Sticker Message]',
            'agent-1',
            'whatsapp'
        )
    } catch (e: any) {
        // Expected to fail when trying to require('@/lib/storage') or uploadMedia
        console.log('HandleChat failed (expected if storage fails):', e.message)
    }

    console.log('Verification finished.')
}

run().catch(console.error)
