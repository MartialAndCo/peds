
import { voiceService } from '../lib/voice'
import { prisma } from '../lib/prisma'
import { whatsapp } from '../lib/whatsapp'

const SOURCE_PHONE = '+999999999'
const USER_PHONE = '123456789'
const NORMALIZED_USER = '+123456789'

// Mock WhatsApp to avoid real calls and track calls
const mockSendText = async (to: string, text: string) => {
    console.log(`[MockWhatsapp] sendText to ${to}: "${text}"`)
    return { id: 'mock_msg_id' }
}
const mockSendVoice = async (to: string, url: string) => {
    console.log(`[MockWhatsapp] sendVoice to ${to}: (Audio URL length: ${url.length})`)
    return { id: 'mock_voice_id' }
}

// Monkey Patch
whatsapp.sendText = mockSendText
whatsapp.sendVoice = mockSendVoice

async function main() {
    console.log('--- STARTING VOICE WORKFLOW SIMULATION ---')

    // 1. Setup Settings
    console.log('\nStep 1: Configuring Voice Source Number...')
    // Check if key exists
    const existing = await prisma.setting.findUnique({ where: { key: 'voice_source_number' } })
    if (existing) {
        await prisma.setting.update({ where: { key: 'voice_source_number' }, data: { value: SOURCE_PHONE } })
    } else {
        await prisma.setting.create({ data: { key: 'voice_source_number', value: SOURCE_PHONE } })
    }
    console.log(`> Voice Source set to ${SOURCE_PHONE}`)

    // Cleanup previous test leftovers
    await prisma.pendingRequest.deleteMany({ where: { requesterPhone: NORMALIZED_USER } })
    await prisma.voiceClip.deleteMany({ where: { transcript: 'TEST_VOICE_SCRIPT' } })

    // 2. Request Voice
    console.log('\nStep 2: Requesting Voice...')
    const textToSay = 'TEST_VOICE_SCRIPT'
    const context = 'Test Simulation'

    await voiceService.requestVoice(NORMALIZED_USER, textToSay, context)

    // Verify DB
    const pending = await prisma.pendingRequest.findFirst({
        where: { requesterPhone: NORMALIZED_USER, status: 'pending', description: textToSay }
    })

    if (pending) {
        console.log('✅ PASSED: PendingRequest created in DB.')
    } else {
        console.error('❌ FAILED: PendingRequest NOT found.')
        process.exit(1)
    }

    // 3. Ingest Voice
    console.log('\nStep 3: Ingesting Voice from Source...')
    // Verify Stealth: Ingest logic returns the necessary info
    // Simulating base64 audio
    const dummyAudio = 'DATA_URI_AUDIO_MOCK'

    const result = await voiceService.ingestVoice(SOURCE_PHONE, dummyAudio)

    if (result && result.targetPhone === NORMALIZED_USER) {
        console.log('✅ PASSED: ingestVoice returned correct target.')
    } else {
        console.error('❌ FAILED: ingestVoice result invalid.', result)
        process.exit(1)
    }

    // Verify DB Fulfillment
    const processedPending = await prisma.pendingRequest.findUnique({ where: { id: pending.id } })
    if (processedPending?.status === 'fulfilled') {
        console.log('✅ PASSED: PendingRequest marked fulfilled.')
    } else {
        console.error('❌ FAILED: PendingRequest status is ' + processedPending?.status)
    }

    // Verify Clip
    const clip = await prisma.voiceClip.findFirst({ where: { transcript: textToSay } })
    if (clip) {
        console.log('✅ PASSED: VoiceClip created.')
    } else {
        console.error('❌ FAILED: VoiceClip not found.')
    }

    // 4. Reuse Voice
    console.log('\nStep 4: Testing Reuse...')
    const reused = await voiceService.findReusableVoice(textToSay)
    if (reused && reused.id === clip?.id) {
        console.log('✅ PASSED: reusableVoice found the clip.')
    } else {
        console.error('❌ FAILED: findReusableVoice did not return the clip.')
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
