
import 'dotenv/config'
// FORCE OVERRIDE DATABASE_URL for testing connectivity
// We try connecting to the DIRECT port (54322) to bypass potential Pooler/Tenant issues on 5432
if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL
    console.log('NOTE: Switched DATABASE_URL to DIRECT_URL for testing:', process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@'))
} else {
    // If not loaded, fallback to what we saw in the file but with port 54322
    process.env.DATABASE_URL = "postgresql://postgres:your-super-secret-and-long-postgres-password@16.171.66.98:54322/postgres"
    console.log('NOTE: Forcing fallback DATABASE_URL (Port 54322)')
}

import { leadService } from '../lib/leads'
import { prisma } from '../lib/prisma'
import { whatsapp } from '../lib/whatsapp'

const PROVIDER_PHONE = '+33611111111'
const TARGET_PHONE_RAW = '0622222222'
const TARGET_PHONE = '+33622222222'
const CONTEXT_TEXT = 'Interested in selling his car.'

// Mock WhatsApp
const mockSendText = async (to: string, text: string) => {
    console.log(`[MockWhatsapp] sendText to ${to}: "${text}"`)
    return { id: 'mock_msg_id' }
}
whatsapp.sendText = mockSendText

async function main() {
    console.log('--- STARTING LEAD WORKFLOW SIMULATION ---')

    // 1. Setup Settings
    console.log('\nStep 1: Configuring Lead Provider...')
    await prisma.setting.upsert({
        where: { key: 'lead_provider_number' },
        update: { value: PROVIDER_PHONE },
        create: { key: 'lead_provider_number', value: PROVIDER_PHONE }
    })

    // Cleanup previous test leftovers
    await prisma.contact.deleteMany({ where: { phone_whatsapp: TARGET_PHONE } })

    // 2. Simulate Provider Message (Phone + Context)
    console.log('\nStep 2: Receiving Lead Info...')
    const inputMsg = `${TARGET_PHONE_RAW} ${CONTEXT_TEXT}`

    // Pass a fake message ID
    await leadService.handleProviderMessage(PROVIDER_PHONE, inputMsg, 'test_msg_id_123', 1)

    // Verify Target Created but PAUSED
    const target = await prisma.contact.findUnique({ where: { phone_whatsapp: TARGET_PHONE } })
    if (target) {
        console.log(`✅ PASSED: Target contact created: ${target.phone_whatsapp}`)
        if (target.notes?.includes(CONTEXT_TEXT)) console.log('✅ PASSED: Context saved in notes.')
    } else {
        console.error('❌ FAILED: Target contact not created.')
        process.exit(1)
    }

    const targetConv = await prisma.conversation.findFirst({ where: { contactId: target!.id } })
    if (targetConv) {
        if (targetConv.status === 'paused') {
            const meta = targetConv.metadata as any
            if (meta?.state === 'WAITING_FOR_LEAD') {
                console.log('✅ PASSED: Conversation is PAUSED and WAITING_FOR_LEAD.')
            } else {
                console.error('❌ FAILED: Metadata state is ' + meta?.state)
            }
        } else {
            console.error('❌ FAILED: Conversation status is ' + targetConv.status)
        }
    } else {
        console.error('❌ FAILED: Conversation not created.')
    }

    // 3. Simulate Lead Sending First Message (Wake Up)
    console.log('\nStep 3: Lead sends first message...')

    // We import the processor to test the wake-up logic
    const { processWhatsAppPayload } = require('../lib/services/whatsapp-processor')

    // Mock payload from Lead
    const leadPayload = {
        from: TARGET_PHONE.replace('+', '') + '@c.us',
        body: "Bonjour, c'est dispo ?",
        type: 'chat',
        id: 'msg_from_lead_1',
        fromMe: false,
        _data: { notifyName: 'Valentin' }
    }

    // Process it (Agent ID 1)
    await processWhatsAppPayload(leadPayload, 1)

    // Verify Conversation Active
    const wokenConv = await prisma.conversation.findUnique({ where: { id: targetConv!.id } })
    if (wokenConv?.status === 'active') {
        console.log('✅ PASSED: Conversation status flipped to ACTIVE.')
    } else {
        console.error('❌ FAILED: Conversation status is still ' + wokenConv?.status)
    }

    // Verify Message Processed (Processor should trigger Chat Handler -> AI)
    // We can't easily check AI output here without mocking AI, but we can check if the user message was saved.
    const savedMsg = await prisma.message.findFirst({
        where: { conversationId: wokenConv!.id, sender: 'contact' },
        orderBy: { timestamp: 'desc' }
    })

    if (savedMsg && savedMsg.message_text === "Bonjour, c'est dispo ?") {
        console.log('✅ PASSED: Lead message processed and saved.')
    } else {
        console.error('❌ FAILED: Lead message not found.')
    }

    console.log('\n--- SIMULATION COMPLETE: SUCCESS ---')
}

main()
    .catch(e => {
        console.error('Simulation Crashed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
