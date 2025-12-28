
import { PrismaClient } from '@prisma/client'
import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function main() {
    console.log("🚀 Starting Media Flow Verification...")

    // 1. Setup Data
    const TEST_PHONE = "33612345678"
    const NORMALIZED_PHONE = "+33612345678"
    // Use env var or default from settings
    const ADMIN_PHONE = process.env.SOURCE_PHONE_NUMBER || "+33695286960"

    // Force DB Setting to match test
    await prisma.setting.upsert({
        where: { key: 'source_phone_number' },
        update: { value: ADMIN_PHONE },
        create: { key: 'source_phone_number', value: ADMIN_PHONE }
    })

    // Clean previous test data
    console.log("Cleaning up old test data...")
    try {
        await prisma.messageQueue.deleteMany({ where: { contact: { phone_whatsapp: NORMALIZED_PHONE } } })
        await prisma.pendingRequest.deleteMany({ where: { requesterPhone: NORMALIZED_PHONE } })
    } catch (e: any) {
        console.log("Cleanup warning (might be empty):", e.message)
    }

    // Create User, Conversation
    console.log("Creating/Updating Contact and Conversation...")
    const contact = await prisma.contact.upsert({
        where: { phone_whatsapp: NORMALIZED_PHONE },
        update: {},
        create: { phone_whatsapp: NORMALIZED_PHONE, name: "Test User", source: "Test" }
    })

    // Ensure Prompt exists
    const prompt = await prisma.prompt.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, name: "Default", system_prompt: "You are a helpful assistant.", temperature: 0.7, max_tokens: 150, model: "llama-3-70b" }
    })

    const conversation = await prisma.conversation.upsert({
        where: { id: 999999 },
        update: {},
        create: {
            contactId: contact.id,
            promptId: prompt.id,
            status: 'active',
            ai_enabled: true
        }
    })

    // Create Fake History (so AI has context)
    console.log("Seeding fake chat history...")
    await prisma.message.create({
        data: { conversationId: conversation.id, sender: 'contact', message_text: "Envoie une photo de tes pieds stp !", timestamp: new Date(Date.now() - 1000 * 60 * 5) }
    })
    await prisma.message.create({
        data: { conversationId: conversation.id, sender: 'ai', message_text: "D'accord, je t'envoie ça ce soir.", timestamp: new Date(Date.now() - 1000 * 60 * 4) }
    })

    // Ensure MediaType exists
    await prisma.mediaType.upsert({
        where: { id: 'photo_pieds' },
        update: {},
        create: { id: 'photo_pieds', description: 'Photos de pieds', keywords: ['pieds'] }
    })

    // Create Pending Request
    console.log("Creating Pending Request...")
    const request = await prisma.pendingRequest.create({
        data: {
            requesterPhone: NORMALIZED_PHONE,
            mediaType: 'image',
            description: 'Test Photo',
            status: 'pending',
            typeId: 'photo_pieds'
        }
    })
    console.log(`[Setup] Pending Request Created: ${request.id}`)

    // 2. Simulate Admin Webhook Payload
    const webhookPayload = {
        event: 'message',
        payload: {
            from: ADMIN_PHONE.replace('+', '') + '@c.us',
            body: 'data:image/jpeg;base64,' + 'A'.repeat(200), // Fake Base64 > 100 chars to bypass download
            fromMe: false,
            type: 'image',
            _data: { mimetype: 'image/png' },
            id: 'false_waha_id_' + Date.now()
        }
    }

    // 3. Send to Webhook
    console.log(`[Action] Sending Simulated Admin Media to Webhook...`)
    try {
        // Use localhost port 3000
        const res = await axios.post('http://localhost:3000/api/webhooks/whatsapp', webhookPayload, {
            headers: { 'Content-Type': 'application/json' }
        })
        console.log(`[Webhook Response] Code: ${res.status}, Data:`, res.data)
    } catch (e: any) {
        console.error(`[Webhook Audit] Request failed (likely WAHA unreachable), but checking DB side-effects...`)
        if (e.response) console.error(`Status: ${e.response.status}`)
        // Do not exit, continue to check DB
    }

    // 4. Verify Result
    console.log(`[Verify] Waiting 3s for processing...`)
    await new Promise(r => setTimeout(r, 3000))

    const queueItems = await prisma.messageQueue.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    })

    console.log(`[Verify] Found ${queueItems.length} total items in Queue (User matches: ${queueItems.filter(i => i.contactId === contact.id).length})`)

    if (queueItems.length > 0) {
        console.log("✅ DUMPING ITEMS:")
        queueItems.forEach(item => {
            console.log(`------------------------------------------------`)
            console.log(`ID: ${item.id}`)
            // Calculate delay
            const minutes = (item.scheduledAt.getTime() - Date.now()) / 60000
            console.log(`Scheduled At: ${item.scheduledAt.toLocaleTimeString()} (Approx ${minutes.toFixed(1)} mins from now)`)
            console.log(`Content (Caption): "${item.content}"`)
            console.log(`Media URL: ${item.mediaUrl}`)
            console.log(`Media Type: ${item.mediaType}`)
            console.log(`------------------------------------------------`)
        })
    } else {
        console.error("❌ FAILURE: No queue items found. The webhook might have failed or ignored the request.")
    }

    console.log("Done.")
}

main()
