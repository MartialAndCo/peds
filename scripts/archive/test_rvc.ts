import { rvcService } from '../lib/rvc'
import * as fs from 'fs'
import * as path from 'path'

async function testRVC() {
    console.log('🎤 Testing RVC endpoint (Complete Test)...\n')

    try {
        // Lire le fichier WAV et convertir en base64
        const wavPath = "C:\\Users\\marti\\Downloads\\New Recording 2.wav"

        if (!fs.existsSync(wavPath)) {
            console.error(`❌ Fichier non trouvé: ${wavPath}`)
            return
        }

        const audioBuffer = fs.readFileSync(wavPath)
        const audioBase64 = `data:audio/wav;base64,${audioBuffer.toString('base64')}`

        console.log(`📁 Fichier: ${path.basename(wavPath)}`)
        console.log(`📊 Taille: ${audioBuffer.length} bytes`)
        console.log(`📊 Base64 length: ${audioBase64.length} chars\n`)

        console.log('📤 Starting RVC job...')

        const jobId = await rvcService.startJob(audioBase64, {
            voiceId: undefined,
            sourceGender: 'male'
        })

        if (!jobId) {
            console.log('❌ Failed to start RVC job. Check config.')
            return
        }

        console.log(`✅ RVC Job started! ID: ${jobId}`)

        // Poll for status using checkJob
        console.log('\n⏳ Polling for completion (max 5 minutes)...')
        for (let i = 0; i < 100; i++) {
            await new Promise(r => setTimeout(r, 3000))

            try {
                const check = await rvcService.checkJob(jobId)
                console.log(`   [${i + 1}] Status: ${check.status}`)

                if (check.status === 'COMPLETED') {
                    console.log('\n✅ RVC SUCCESS!')
                    if (check.output?.audio_base64) {
                        const preview = check.output.audio_base64.substring(0, 50)
                        console.log(`📩 Audio Base64 (preview): ${preview}...`)
                        console.log(`   Full length: ${check.output.audio_base64.length} chars`)

                        // Save output
                        const outputBuffer = Buffer.from(check.output.audio_base64, 'base64')
                        const outputPath = "C:\\Users\\marti\\Downloads\\rvc_output.mp3"
                        fs.writeFileSync(outputPath, outputBuffer)
                        console.log(`💾 Saved to: ${outputPath}`)
                    }
                    return
                }

                if (check.status === 'FAILED' || check.status === 'TIMED_OUT' || check.status === 'error') {
                    console.log(`\n❌ RVC Job FAILED: ${check.status}`)
                    console.log('   Output:', JSON.stringify(check.output || check.error || check, null, 2))
                    return
                }
            } catch (pollErr: any) {
                console.log(`   [${i + 1}] Poll error: ${pollErr.message}`)
            }
        }

        console.log('\n⏰ Timeout after 5 minutes')
    } catch (error: any) {
        console.error('❌ Error:', error.message)
    }
}

testRVC()
