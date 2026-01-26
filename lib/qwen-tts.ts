
import { prisma } from '@/lib/prisma'
import { settingsService } from '@/lib/settings-cache'

export interface TtsJobOptions {
    text: string
    voiceSampleUrl?: string
    voiceSampleBase64?: string
    language?: string
    skipTranscription?: boolean
    voiceId?: number
    agentId?: string
}

export const qwenTtsService = {
    /**
     * Get configuration for TTS generation
     */
    async _getConfig(options: { voiceId?: number, agentId?: string }) {
        const settings = await settingsService.getSettings()

        let voiceSampleUrl = ""
        let language = "Auto"

        if (options.voiceId) {
            const voice = await prisma.voiceModel.findUnique({ where: { id: options.voiceId } })
            if (voice) {
                voiceSampleUrl = voice.voiceSampleUrl
                language = voice.language || "Auto"
            }
        } else if (options.agentId) {
            const agent = await prisma.agent.findUnique({
                where: { id: options.agentId },
                include: { voiceModel: true }
            })
            if (agent) {
                // Agent language overrides voice model language
                language = agent.language || "Auto"
                if ((agent as any).voiceModel) {
                    voiceSampleUrl = (agent as any).voiceModel.voiceSampleUrl
                    // Use agent language if set, otherwise fall back to voice model language
                    if (language === "Auto" && (agent as any).voiceModel.language) {
                        language = (agent as any).voiceModel.language
                    }
                }
            }
        }

        const ttsUrl = process.env.TTS_API_URL || settings.tts_api_url || ''
        const runpodKey = process.env.RUNPOD_API_KEY || settings.runpod_api_key

        return { ttsUrl, runpodKey, voiceSampleUrl, language }
    },

    /**
     * Starts an Async TTS Job (RunPod)
     */
    async startJob(options: TtsJobOptions) {
        const config = await this._getConfig({ voiceId: options.voiceId, agentId: options.agentId })

        const voiceSampleUrl = options.voiceSampleUrl || config.voiceSampleUrl
        const language = options.language || config.language || "Auto"

        console.log(`[TTS-Async] Config: ttsUrl=${config.ttsUrl}, language=${language}`)

        if (!config.runpodKey) {
            console.error('[TTS-Async] CRITICAL: No RunPod API Key configured!')
            return null
        }

        if (!options.text) {
            console.error('[TTS-Async] CRITICAL: No text provided!')
            return null
        }

        if (!voiceSampleUrl && !options.voiceSampleBase64) {
            console.error('[TTS-Async] CRITICAL: No voice sample provided!')
            return null
        }

        const payload: any = {
            input: {
                text: options.text,
                language: language,
                skip_transcription: options.skipTranscription ?? false
            }
        }

        // Add voice sample (URL or Base64)
        if (voiceSampleUrl) {
            payload.input.voice_sample_url = voiceSampleUrl
        } else if (options.voiceSampleBase64) {
            let cleanBase64 = options.voiceSampleBase64
            if (cleanBase64.includes('base64,')) {
                cleanBase64 = cleanBase64.split('base64,')[1]
            }
            payload.input.voice_sample_base64 = cleanBase64
        }

        // Add Webhook
        const appUrl = process.env.WEBHOOK_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://peds.ngrok.io'
        if (appUrl && appUrl.startsWith('http')) {
            payload.webhook = `${appUrl}/api/webhooks/runpod`
            console.log(`[TTS-Async] Webhook: ${payload.webhook}`)
        }

        // Build endpoint
        let endpoint = config.ttsUrl
        if (!endpoint.includes('/run') && !endpoint.includes('/submit')) {
            endpoint = endpoint.replace(/\/runsync$/, '')
            endpoint = `${endpoint.replace(/\/$/, '')}/run`
        }

        console.log(`[TTS-Async] Starting Job at ${endpoint}...`)
        console.log(`[TTS-Async] Text: "${options.text.substring(0, 100)}${options.text.length > 100 ? '...' : ''}"`)

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.runpodKey}`
                },
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unable to read error body')
                console.error(`[TTS-Async] Job start FAILED. Status: ${response.status}, Body: ${errorText}`)
                return null
            }

            const data = await response.json()
            console.log(`[TTS-Async] Job started successfully. Job ID: ${data.id}`)
            return data.id
        } catch (fetchErr: any) {
            console.error(`[TTS-Async] Fetch error: ${fetchErr.message}`)
            return null
        }
    },

    /**
     * Checks the status of a RunPod TTS Job
     */
    async checkJob(jobId: string) {
        const settings = await settingsService.getSettings()
        const ttsUrl = process.env.TTS_API_URL || settings.tts_api_url
        const runpodKey = process.env.RUNPOD_API_KEY || settings.runpod_api_key

        let baseUrl = ttsUrl.replace(/\/runsync$/, '').replace(/\/run$/, '').replace(/\/$/, '')
        const statusUrl = `${baseUrl}/status/${jobId}`

        const response = await fetch(statusUrl, {
            headers: { 'Authorization': `Bearer ${runpodKey}` }
        })

        if (!response.ok) return { status: 'FAILED' }
        const data = await response.json()
        return data // { status: "COMPLETED", output: { audio_base64, reference_text, sample_rate } }
    },

    /**
     * Sync TTS generation (wraps async with polling)
     */
    async generateVoice(options: TtsJobOptions): Promise<{ audioBase64: string | null, referenceText?: string }> {
        console.log(`[TTS-SyncWrapper] Starting async job...`)

        const jobId = await this.startJob(options)

        if (!jobId) {
            console.error('[TTS-SyncWrapper] Failed to start job.')
            return { audioBase64: null }
        }

        console.log(`[TTS-SyncWrapper] Job ${jobId} started. Polling...`)

        // Max wait: 5 minutes
        const MAX_ATTEMPTS = 100
        const DELAY_MS = 3000

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await new Promise(r => setTimeout(r, DELAY_MS))

            const check = await this.checkJob(jobId)

            if (check.status === 'COMPLETED' && check.output?.audio_base64) {
                console.log(`[TTS-SyncWrapper] Job ${jobId} completed!`)
                return {
                    audioBase64: `data:audio/wav;base64,${check.output.audio_base64}`,
                    referenceText: check.output.reference_text
                }
            }
            else if (check.status === 'FAILED' || check.status === 'TIMED_OUT' || check.status === 'error') {
                console.error(`[TTS-SyncWrapper] Job ${jobId} failed: ${check.status}`)
                return { audioBase64: null }
            }

            if (i % 10 === 0) console.log(`[TTS-SyncWrapper] Waiting... (${i}/${MAX_ATTEMPTS})`)
        }

        console.error(`[TTS-SyncWrapper] Job ${jobId} timed out.`)
        return { audioBase64: null }
    }
}
