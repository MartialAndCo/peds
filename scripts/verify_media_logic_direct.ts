
import { PrismaClient } from '@prisma/client'
import { mediaService } from '../lib/media.js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })
const prisma = new PrismaClient()

async function main() {
    console.log("🚀 Starting DIRECT Media Logic Verification...")

    // 1. Setup Data
    const TEST_PHONE = "33612345678"
    const NORMALIZED_PHONE = "+33612345678"
    const ADMIN_PHONE = process.env.SOURCE_PHONE_NUMBER || "+33695286960"

    // Cleanup
    await prisma.messageQueue.deleteMany({ where: { contact: { phone_whatsapp: NORMALIZED_PHONE } } })
    await prisma.pendingRequest.deleteMany({ where: { requesterPhone: NORMALIZED_PHONE } })

    // Create User, Conversation, MediaType
    await prisma.mediaType.upsert({
        where: { id: 'photo_pieds' }, update: {}, create: { id: 'photo_pieds' }
    })

    const contact = await prisma.contact.upsert({
        where: { phone_whatsapp: NORMALIZED_PHONE },
        update: {},
        create: { phone_whatsapp: NORMALIZED_PHONE, name: "Test User", source: "Test" }
    })

    await prisma.conversation.upsert({
        where: { id: 999999 },
        update: {},
        create: { contactId: contact.id, promptId: 1, status: 'active', ai_enabled: true }
    })

    // Create Pending Request
    const request = await prisma.pendingRequest.create({
        data: {
            requesterPhone: NORMALIZED_PHONE,
            mediaType: 'image',
            description: 'Test Photo',
            status: 'pending',
            typeId: 'photo_pieds'
        }
    })
    console.log(`[Setup] Pending Request: ${request.id}`)

    // 2. Simulate Ingestion + Processing (Bypassing route.ts and axios)
    console.log("[Action] Calling ingestMedia...")
    const base64Data = 'data:image/jpeg;base64,' + 'A'.repeat(200)

    const ingestionResult = await mediaService.ingestMedia(ADMIN_PHONE, base64Data, 'image/jpeg')

    if (!ingestionResult) {
        console.error("❌ Ingestion Failed (Returned null)")
        process.exit(1)
    }
    console.log("✅ Ingestion Success:", ingestionResult)

    console.log("[Action] Calling processAdminMedia...")
    try {
        const item = await mediaService.processAdminMedia(ADMIN_PHONE, ingestionResult)
        if (item) {
            console.log("✅ SUCCESS! Queue Item Created:", item.id)
            console.log("Scheduled At:", item.scheduledAt)
            console.log("Caption:", item.content)
        } else {
            console.error("❌ processAdminMedia returned null")
        }
    } catch (e: any) {
        console.error("❌ processAdminMedia Threw:", e.message)
    }

    // Verify DB
    const queueItems = await prisma.messageQueue.findMany({ where: { contactId: contact.id } })
    console.log(`[Verify] Items in DB: ${queueItems.length}`)

    console.log("Done.")
}

main()
