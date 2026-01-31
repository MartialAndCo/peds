import axios from 'axios'
import { prisma } from '../lib/prisma'
require('dotenv').config({ path: '.env.local' });

const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/whatsapp'
const CRON_URL = 'http://localhost:3000/api/cron/process-incoming'
const TEST_PHONE = '33700000001'
const TEST_JID = `${TEST_PHONE}@c.us`

async function main() {
    console.log('🧹 Cleaning up...')
    // Use raw query for deleteMany if relation issues, but standard should work
    try {
        await prisma.incomingQueue.deleteMany({ where: { payload: { path: ['payload', 'from'], equals: TEST_JID } } })

        const contact = await prisma.contact.findFirst({ where: { phone_whatsapp: `+${TEST_PHONE}` } })
        if (contact) {
            await prisma.message.deleteMany({ where: { conversation: { contactId: contact.id } } })
            await prisma.conversation.deleteMany({ where: { contactId: contact.id } })
            await prisma.contact.delete({ where: { id: contact.id } })
        }
    } catch (e) {
        // Ignored
    }

    // Init
    console.log('🚀 Sending Init message...')
    await sendWebhook("Init", 0)
    await new Promise(r => setTimeout(r, 2000))
    // Trigger Cron for Init
    try { await axios.get(CRON_URL); console.log('✅ Cron Triggered for Init'); } catch (e) { }
    await new Promise(r => setTimeout(r, 5000)) // Wait for processing

    // Activate
    const initContact = await prisma.contact.findFirst({ where: { phone_whatsapp: `+${TEST_PHONE}` } })
    if (initContact) {
        await prisma.conversation.updateMany({ where: { contactId: initContact.id }, data: { status: 'active' } })
        console.log('✅ Conversation Activated')
    }

    console.log('🚀 Sending Burst of 3 messages...')

    // Msg 1
    await sendWebhook("Hello!", 1)
    // Msg 2
    await sendWebhook("Are you there?", 2)
    // Msg 3
    await sendWebhook("Please answer me now.", 3)

    console.log(`\n⏳ Waiting 2s for webhook to queue...`)

    // Debug DB
    const dbUrl = process.env.DATABASE_URL || 'UNKNOWN'
    console.log(`[DEBUG] DB URL: ${dbUrl.substring(0, 15)}...`)

    // Verify Queue
    const allItems = await prisma.incomingQueue.findMany({ select: { id: true, status: true, payload: true } })
    console.log(`📊 All Queue Items (Count: ${allItems.length}):`)
    allItems.forEach(i => console.log(`   - ID ${i.id}: ${i.status} (${(i.payload as any).payload?.body})`))

    const queuedCount = allItems.filter(i => i.status === 'PENDING').length
    console.log(`📊 Pending Items: ${queuedCount}`)

    console.log('🔄 Triggering CRON manually...')
    try {
        const cronRes = await axios.get(CRON_URL)
        console.log('✅ Cron Result:', cronRes.data)
    } catch (e: any) {
        console.error('❌ Cron Failed:', e.message)
        // Check if server is running
        if (e.code === 'ECONNREFUSED') {
            console.error('CRITICAL: Local server not running on port 3000. Start it with `npm run dev`.')
            return
        }
    }

    console.log('⏳ Waiting 15s for Async AI processing/generation...')
    await new Promise(r => setTimeout(r, 15000))

    // Verify
    const contact = await prisma.contact.findFirst({ where: { phone_whatsapp: `+${TEST_PHONE}` } })
    if (!contact) { console.error('❌ Contact not created'); return }

    const conv = await prisma.conversation.findFirst({ where: { contactId: contact.id } })
    if (!conv) { console.error('❌ Conversation not created'); return }

    const messages = await prisma.message.findMany({
        where: { conversationId: conv.id },
        orderBy: { timestamp: 'asc' }
    })

    const userMsgs = messages.filter((m: any) => m.sender === 'contact')
    const aiMsgs = messages.filter((m: any) => m.sender === 'ai')

    console.log(`\n📊 RESULTS for ${TEST_PHONE}:`)
    console.log(`User Messages: ${userMsgs.length} (Expected 3)`)
    console.log(`AI Messages: ${aiMsgs.length} (Expected 1)`)

    userMsgs.forEach((m: any) => console.log(`  👤 User: ${m.message_text}`))
    aiMsgs.forEach((m: any) => console.log(`  🤖 AI: ${m.message_text}`))

    if (userMsgs.length === 3 && aiMsgs.length === 1) {
        console.log('\n✅ SUCCESS: Burst Mode Logic Verified! All messages saved, only 1 AI response.')
        // Clean up
        // await prisma.contact.delete({ where: { id: contact.id } })
    } else {
        console.log('\n❌ FAILURE: Logic mismatch.')
    }
}

async function sendWebhook(text: string, idSuffix: number) {
    try {
        await axios.post(WEBHOOK_URL, {
            event: 'message',
            sessionId: '1',
            payload: {
                id: `burst_test_${Date.now()}_${idSuffix}`,
                from: TEST_JID,
                body: text,
                fromMe: false,
                _data: { notifyName: "Burst Tester" },
                type: 'chat',
                timestamp: Math.floor(Date.now() / 1000)
            }
        }, { headers: { 'x-internal-secret': process.env.WEBHOOK_SECRET } })
        process.stdout.write(`Sent ${idSuffix}... `)
    } catch (e: any) {
        console.error("Webhook Error:", e.message)
    }
}

main()
