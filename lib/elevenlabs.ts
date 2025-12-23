import axios from 'axios'

export const elevenlabs = {
    async generateAudio(text: string, config: { apiKey?: string, voiceId?: string } = {}) {
        const apiKey = config.apiKey || process.env.ELEVENLABS_API_KEY
        if (!apiKey) {
            console.warn('ELEVENLABS_API_KEY not configured')
            throw new Error("ElevenLabs API Key missing")
        }

        const voiceId = config.voiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM' // Rachel default

        try {
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
                        'Accept': 'audio/mpeg' // Request MP3
                    },
                    responseType: 'arraybuffer' // Get binary data
                }
            )

            // Convert buffer to Base64 for WAHA
            const audioBuffer = Buffer.from(response.data)
            const base64Audio = audioBuffer.toString('base64')
            return `data:audio/mpeg;base64,${base64Audio}`

        } catch (error: any) {
            console.error('ElevenLabs TTS Error:', error.response?.data ? JSON.parse(Buffer.from(error.response.data).toString()) : error.message)
            throw new Error(`ElevenLabs generation failed: ${error.message}`)
        }
    },

    async transcribeAudio(audioBuffer: Buffer, config: { apiKey?: string } = {}) {
        const apiKey = config.apiKey || process.env.ELEVENLABS_API_KEY
        if (!apiKey) {
            throw new Error("ElevenLabs API Key missing for transcription")
        }

        try {
            const FormData = require('form-data')
            const form = new FormData()
            form.append('file', audioBuffer, { filename: 'audio.mp3', contentType: 'audio/mpeg' })
            form.append('model_id', 'scribe_v1')

            const response = await axios.post(
                'https://api.elevenlabs.io/v1/speech-to-text',
                form,
                {
                    headers: {
                        ...form.getHeaders(),
                        'xi-api-key': apiKey
                    }
                }
            )

            // logger.log('ElevenLabs: Success', response.data)
            return response.data.text

        } catch (error: any) {
            console.error('ElevenLabs STT Error:', error.response?.data || error.message)
            throw new Error(`ElevenLabs transcription failed: ${error.message}`)
        }
    }
}
