
import axios from 'axios'
import FormData from 'form-data'
import { settingsService } from '@/lib/settings-cache'

export const transcriptionService = {
    /**
     * Transcribe audio buffer using Groq's Whisper API.
     * @param buffer The audio file buffer
     * @param filename Desired filename with extension (e.g. "audio.ogg")
     */
    async transcribe(buffer: Buffer, filename: string = 'audio.ogg'): Promise<string | null> {
        console.log(`[Transcription] Starting transcription for ${filename}...`)

        const settings = await settingsService.getSettings()
        const apiKey = settings.groq_api_key

        if (!apiKey) {
            console.error('[Transcription] No GROQ_API_KEY configured.')
            return null
        }

        try {
            const form = new FormData()
            form.append('file', buffer, { filename })
            form.append('model', 'whisper-large-v3')
            form.append('response_format', 'json')

            // Note: Groq expects multipart/form-data
            const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
                headers: {
                    ...form.getHeaders(),
                    'Authorization': `Bearer ${apiKey}`
                }
            })

            const text = response.data.text
            console.log(`[Transcription] Success: "${text.substring(0, 50)}..."`)
            return text

        } catch (error: any) {
            console.error('[Transcription] Failed:', error.response?.data || error.message)
            return null
        }
    }
}
