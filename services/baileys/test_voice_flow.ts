/**
 * End-to-End Voice Test Script
 * Tests the entire flow: URL Download -> ffmpeg Conversion -> WhatsApp Send
 * Run from services/baileys directory: npx tsx test_voice_flow.ts
 */
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'

// Test URL (the actual Supabase URL from logs)
const TEST_URL = "https://cfpcmrecikujyjammjck.supabase.co/storage/v1/object/public/voice-uploads/voice_1768614108606_p2mwxo.wav"

// Baileys Server (localhost if running on same machine)
const BAILEYS_URL = "http://localhost:3001"
const API_KEY = process.env.AUTH_TOKEN || "YOUR_AUTH_TOKEN"

async function testDownload(): Promise<Buffer> {
    console.log('\n=== STEP 1: Download from URL ===')
    console.log(`URL: ${TEST_URL}`)

    try {
        const res = await axios.get(TEST_URL, { responseType: 'arraybuffer', timeout: 30000 })
        console.log(`✅ Download successful - Status: ${res.status}`)
        console.log(`   Content-Type: ${res.headers['content-type']}`)
        console.log(`   Data type: ${typeof res.data}`)
        console.log(`   Data constructor: ${res.data?.constructor?.name}`)
        console.log(`   Data length: ${res.data?.byteLength || res.data?.length || 'N/A'}`)

        const buffer = Buffer.from(res.data)
        console.log(`   Buffer created: ${buffer.length} bytes`)

        // Save to file to verify
        const testPath = '/tmp/test_download.wav'
        fs.writeFileSync(testPath, buffer)
        console.log(`   Saved to: ${testPath}`)

        // Verify file is readable
        const readBack = fs.readFileSync(testPath)
        console.log(`   Read back: ${readBack.length} bytes`)

        return buffer
    } catch (e: any) {
        console.log(`❌ Download FAILED: ${e.message}`)
        console.log(`   Code: ${e.code}`)
        console.log(`   Response: ${e.response?.status} ${e.response?.statusText}`)
        throw e
    }
}

async function testFFmpegConversion(inputBuffer: Buffer): Promise<Buffer> {
    console.log('\n=== STEP 2: FFmpeg Conversion to OGG/OPUS ===')

    const tempIn = path.join('/tmp', `ffmpeg_test_in_${Date.now()}.wav`)
    const tempOut = path.join('/tmp', `ffmpeg_test_out_${Date.now()}.ogg`)

    try {
        console.log(`   Input buffer size: ${inputBuffer.length}`)
        fs.writeFileSync(tempIn, inputBuffer)
        console.log(`   Wrote input to: ${tempIn}`)

        // Check if file exists and is readable
        const stat = fs.statSync(tempIn)
        console.log(`   Input file stat: ${stat.size} bytes`)

        await new Promise<void>((resolve, reject) => {
            ffmpeg(tempIn)
                .toFormat('opus')
                .outputOptions([
                    '-acodec libopus',
                    '-ac 1',
                    '-ar 48000'
                ])
                .on('start', (cmd) => console.log(`   FFmpeg command: ${cmd}`))
                .on('progress', (p) => console.log(`   Progress: ${p.percent?.toFixed(1)}%`))
                .on('end', () => {
                    console.log(`✅ Conversion successful`)
                    resolve()
                })
                .on('error', (err) => {
                    console.log(`❌ FFmpeg error: ${err.message}`)
                    reject(err)
                })
                .save(tempOut)
        })

        const outputBuffer = fs.readFileSync(tempOut)
        console.log(`   Output file: ${outputBuffer.length} bytes`)

        // Cleanup
        fs.unlinkSync(tempIn)
        fs.unlinkSync(tempOut)

        return outputBuffer
    } catch (e: any) {
        console.log(`❌ FFmpeg FAILED: ${e.message}`)
        throw e
    }
}

async function testSendToWhatsApp(buffer: Buffer): Promise<void> {
    console.log('\n=== STEP 3: Send to WhatsApp API ===')
    console.log(`   Baileys URL: ${BAILEYS_URL}`)
    console.log(`   Buffer size: ${buffer.length}`)

    // Simulate the payload structure from lib/whatsapp.ts
    const payload = {
        sessionId: '1',
        chatId: '+33753777980', // Test number from logs
        file: {
            mimetype: 'audio/wav',
            data: buffer.toString('base64'), // Using base64 for direct test
            filename: 'voice.wav'
        }
    }

    console.log(`   Payload file.data length: ${payload.file.data.length}`)

    try {
        const res = await axios.post(`${BAILEYS_URL}/api/sendVoice`, payload, {
            headers: { 'X-Api-Key': API_KEY },
            timeout: 60000
        })
        console.log(`✅ Send successful: ${JSON.stringify(res.data)}`)
    } catch (e: any) {
        console.log(`❌ Send FAILED: ${e.message}`)
        if (e.response) {
            console.log(`   Status: ${e.response.status}`)
            console.log(`   Data: ${JSON.stringify(e.response.data)}`)
        }
        throw e
    }
}

async function run() {
    console.log('========================================')
    console.log('  VOICE FLOW END-TO-END TEST')
    console.log('========================================')

    try {
        // Step 1: Download
        const downloadedBuffer = await testDownload()

        // Step 2: Convert
        const convertedBuffer = await testFFmpegConversion(downloadedBuffer)

        // Step 3: Send (commented out by default to avoid spam)
        // await testSendToWhatsApp(convertedBuffer)
        console.log('\n=== STEP 3: Send to WhatsApp ===')
        console.log('   ⚠️ Skipped (uncomment in script to test)')

        console.log('\n========================================')
        console.log('  ALL TESTS PASSED ✅')
        console.log('========================================')
    } catch (e: any) {
        console.log('\n========================================')
        console.log(`  TEST FAILED ❌: ${e.message}`)
        console.log('========================================')
    }
}

run()
