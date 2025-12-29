
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

    // Ensure provider contact exists and has idle state
    let prov = await prisma.contact.findFirst({ where: { phone_whatsapp: PROVIDER_PHONE } })
    if (!prov) prov = await prisma.contact.create({ data: { phone_whatsapp: PROVIDER_PHONE, source: 'sys' } })

    // Upsert conversation to reset state
    // Note: metadata update might fail if types not valid yet, but runtime should work if DB has it.
    let conv = await prisma.conversation.findFirst({ where: { contactId: prov.id } })
    if (!conv) {
        const prompt = await prisma.prompt.findFirst()
        if (prompt) conv = await prisma.conversation.create({ data: { contactId: prov.id, promptId: prompt.id, metadata: { state: 'IDLE' } } })
    } else {
        await prisma.conversation.update({ where: { id: conv.id }, data: { metadata: { state: 'IDLE' } } })
    }

    // 2. Simulate Provider Message (Phone + Context)
    console.log('\nStep 2: Receiving Lead Info...')
    const inputMsg = `${TARGET_PHONE_RAW} ${CONTEXT_TEXT}`
    await leadService.handleProviderMessage(PROVIDER_PHONE, inputMsg)

    // Verify State is CONFIRMING
    const updatedConv = await prisma.conversation.findUnique({ where: { id: conv!.id } })
    const meta = updatedConv!.metadata as any
    if (meta.state === 'CONFIRMING' && meta.draft.phone === TARGET_PHONE) {
        console.log('✅ PASSED: State is CONFIRMING with correct Draft.')
    } else {
        console.error('❌ FAILED: State is ' + meta.state)
        console.log(meta)
        process.exit(1)
    }

    // 3. Simulate Confirmation (OK)
    console.log('\nStep 3: Confirming Lead...')
    await leadService.handleProviderMessage(PROVIDER_PHONE, 'OK')

    // Verify Target Created
    const target = await prisma.contact.findUnique({ where: { phone_whatsapp: TARGET_PHONE } })
    if (target) {
        console.log(`✅ PASSED: Target contact created: ${target.phone_whatsapp}`)
        if (target.notes?.includes(CONTEXT_TEXT)) console.log('✅ PASSED: Context saved in notes.')
    } else {
        console.error('❌ FAILED: Target contact not created.')
    }

    // Verify Conversation Started & Message Sent
    const targetConv = await prisma.conversation.findFirst({ where: { contactId: target!.id } })
    if (targetConv) {
        const msgs = await prisma.message.findMany({ where: { conversationId: targetConv.id } })
        if (msgs.length > 0) {
            console.log(`✅ PASSED: Opener message generated: "${msgs[0].message_text}"`)
        } else {
            console.error('❌ FAILED: No message generated.')
        }
    } else {
        console.error('❌ FAILED: Target conversation not created.')
    }

    // Verify Provider Reset to IDLE
    const finalConv = await prisma.conversation.findUnique({ where: { id: conv!.id } })
    const finalMeta = finalConv!.metadata as any
    if (finalMeta.state === 'IDLE') {
        console.log('✅ PASSED: Provider state reset to IDLE.')
    } else {
        console.error('❌ FAILED: Provider state not reset.')
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
