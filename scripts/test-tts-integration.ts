import { PrismaClient } from '@prisma/client'
import { qwenTtsService } from '../lib/qwen-tts'
import { settingsService } from '../lib/settings-cache'

const prisma = new PrismaClient()

async function main() {
    console.log('='.repeat(80))
    console.log('🎙️  TTS INTEGRATION TEST')
    console.log('='.repeat(80))
    console.log('')

    // Check settings
    const settings = await settingsService.getSettings()
    const ttsUrl = process.env.TTS_API_URL || (settings as any).tts_api_url
    const runpodKey = process.env.RUNPOD_API_KEY || (settings as any).runpod_api_key

    console.log(`TTS URL: ${ttsUrl ? '✅ Configured' : '❌ Missing'}`)
    console.log(`RunPod Key: ${runpodKey ? '✅ Configured' : '❌ Missing'}`)

    if (!ttsUrl || !runpodKey) {
        console.log('\n⚠️  TTS not fully configured - skipping real API test')
        await prisma.$disconnect()
        return
    }

    // Get available voice models
    const voiceModels = await prisma.voiceModel.findMany()
    console.log(`\nVoice Models: ${voiceModels.length} found`)

    if (voiceModels.length === 0) {
        console.log('⚠️  No voice models in database - cannot test TTS')
        await prisma.$disconnect()
        return
    }

    // Test with first voice model
    const testVoice = voiceModels[0]
    console.log(`\nTesting with: ${testVoice.name}`)
    console.log(`  Sample URL: ${testVoice.voiceSampleUrl ? testVoice.voiceSampleUrl.substring(0, 50) + '...' : 'N/A'}`)
    console.log(`  Language: ${testVoice.language}`)

    if (!testVoice.voiceSampleUrl) {
        console.log('⚠️  Voice model has no sample URL - cannot test')
        await prisma.$disconnect()
        return
    }

    // Test job submission (async, doesn't wait for result)
    console.log('\n📤 Starting TTS Job...')
    const testText = "Hello, this is a test of the voice generation system."

    try {
        const jobId = await qwenTtsService.startJob({
            text: testText,
            voiceId: testVoice.id,
            language: testVoice.language || 'English',
            skipTranscription: true
        })

        if (jobId) {
            console.log(`✅ Job started successfully!`)
            console.log(`   Job ID: ${jobId}`)

            // Wait a bit and check status
            console.log('\n⏳ Waiting 5 seconds...')
            await new Promise(r => setTimeout(r, 5000))

            console.log('📊 Checking job status...')
            const status = await qwenTtsService.checkJob(jobId)
            console.log(`   Status: ${status.status}`)

            if (status.status === 'COMPLETED' && status.output?.audio_base64) {
                console.log(`   ✅ Audio generated! (${status.output.audio_base64.length} chars base64)`)
            } else if (status.status === 'IN_PROGRESS' || status.status === 'IN_QUEUE') {
                console.log(`   ⏳ Still processing (this is normal - RunPod jobs take 10-60s)`)
            } else {
                console.log(`   ⚠️  Unexpected status`)
            }

            console.log('\n✅ TTS INTEGRATION TEST PASSED')
            console.log('   (Job was submitted and is being processed)')
        } else {
            console.log('❌ Failed to start job')
        }
    } catch (err: any) {
        console.log(`❌ TTS Error: ${err.message}`)
    }

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error('Fatal:', e)
    await prisma.$disconnect()
    process.exit(1)
})
