const { PrismaClient } = require('@prisma/client')
const axios = require('axios')
const fs = require('fs')

const prisma = new PrismaClient()

async function testElevenLabs() {
    console.log('--- Testing ElevenLabs Generation ---')
    try {
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc, curr) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        const apiKey = settings.elevenlabs_api_key
        const voiceId = settings.elevenlabs_voice_id || '21m00Tcm4TlvDq8ikWAM' // Default Rachel

        console.log(`API Key set: ${!!apiKey}`)
        console.log(`Voice ID: '${voiceId}'`)

        if (!apiKey) {
            console.error('No API Key found in DB')
            return
        }

        const text = "Ceci est un test de génération vocale pour vérifier la configuration."
        console.log(`Generating audio for text: "${text}"`)

        // Mimic lib/elevenlabs.ts logic exactly
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                text: text,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            },
            {
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                responseType: 'arraybuffer'
            }
        )

        console.log('Response Status:', response.status)
        console.log('Audio generated successfully. Size:', response.data.length)

    } catch (error) {
        console.error('ElevenLabs Error:', error.message)
        if (error.response) {
            console.error('Status:', error.response.status)
            try {
                // ElevenLabs error body is often JSON inside buffer
                const body = Buffer.isBuffer(error.response.data)
                    ? error.response.data.toString()
                    : JSON.stringify(error.response.data)
                console.error('Body:', body)
            } catch (e) {
                console.error('Could not parse error body')
            }
        }
    } finally {
        await prisma.$disconnect()
    }
}

testElevenLabs()
