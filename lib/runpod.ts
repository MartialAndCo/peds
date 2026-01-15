import axios from 'axios'
import { logger } from './logger'
import { settingsService } from '@/lib/settings-cache'

const RUNPOD_ENDPOINT = 'https://api.runpod.ai/v2/ihpu7nsjr8numn/run'
const RUNPOD_STATUS_ENDPOINT = 'https://api.runpod.ai/v2/ihpu7nsjr8numn/status'

export const runpod = {
    /**
     * Send a chat completion request to RunPod serverless GPU.
     * This is intended as a last-resort fallback when OpenRouter and Venice both fail.
     */
    /**
     * Submit a job to RunPod and return the Job ID immediately.
     */
    async submitJob(
        systemPrompt: string,
        messages: { role: string, content: string }[],
        userMessage: string,
        config: { apiKey?: string; model?: string; temperature?: number; max_tokens?: number } = {}
    ): Promise<string> {
        let apiKey = config.apiKey || process.env.RUNPOD_API_KEY
        if (!apiKey) {
            try {
                const settings = await settingsService.getSettings()
                apiKey = (settings as any).runpod_api_key
            } catch (e) { }
        }

        if (!apiKey) return ""

        const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: m.content
            })),
            { role: 'user', content: userMessage }
        ]

        try {
            console.log('[RunPod] Submitting async job...')
            const response = await axios.post(RUNPOD_ENDPOINT, {
                input: {
                    messages: apiMessages,
                    temperature: config.temperature ?? 0.7,
                    max_tokens: config.max_tokens ?? 500,
                    model: config.model || 'default'
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            })

            const jobId = response.data?.id
            console.log(`[RunPod] Job submitted: ${jobId}`)
            return jobId || ""
        } catch (error: any) {
            console.error('[RunPod] Job submission failed:', error.message)
            return ""
        }
    },

    /**
     * Check the status of a job.
     * Returns the content if COMPLETED, null if IN_PROGRESS, or throw error if FAILED/CANCELLED.
     */
    async checkJobStatus(jobId: string, apiKey?: string): Promise<{ status: string, output?: string }> {
        if (!apiKey) {
            apiKey = process.env.RUNPOD_API_KEY
            if (!apiKey) {
                try {
                    const settings = await settingsService.getSettings()
                    apiKey = (settings as any).runpod_api_key
                } catch (e) { }
            }
        }

        if (!apiKey) throw new Error("Missing RunPod API Key")

        const statusResponse = await axios.get(`${RUNPOD_STATUS_ENDPOINT}/${jobId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            timeout: 5000
        })

        const status = statusResponse.data?.status
        const output = statusResponse.data?.output

        if (status === 'COMPLETED') {
            // Parse logic (same as before)
            let finalContent = ""
            if (Array.isArray(output) && output.length > 0) {
                if (typeof output[0] === 'string') {
                    try {
                        const parsed = JSON.parse(output[0])
                        if (parsed.choices?.[0]?.message?.content) {
                            finalContent = parsed.choices[0].message.content
                        } else {
                            finalContent = output[0]
                        }
                    } catch (e) { finalContent = output[0] }
                }
            }
            else if (typeof output === 'string') {
                try {
                    const parsed = JSON.parse(output)
                    if (parsed.choices?.[0]?.message?.content) {
                        finalContent = parsed.choices[0].message.content
                    } else { finalContent = output }
                } catch (e) { finalContent = output }
            }
            else if (output?.choices?.[0]?.message?.content) {
                finalContent = output.choices[0].message.content
            }

            return { status: 'COMPLETED', output: finalContent }
        }

        return { status }
    },

    /**
     * Legacy Wrapper (Sync)
     */
    async chatCompletion(
        systemPrompt: string,
        messages: { role: string, content: string }[],
        userMessage: string,
        config: { apiKey?: string; model?: string; temperature?: number; max_tokens?: number } = {}
    ): Promise<string> {
        const jobId = await this.submitJob(systemPrompt, messages, userMessage, config)
        if (!jobId) return ""

        // Polling loop (same as before)
        const maxPolls = 60
        for (let i = 0; i < maxPolls; i++) {
            await new Promise(r => setTimeout(r, 2000))
            try {
                const result = await this.checkJobStatus(jobId, config.apiKey)
                if (result.status === 'COMPLETED') return result.output || ""
                if (result.status === 'FAILED' || result.status === 'CANCELLED') return ""
            } catch (e) { console.error(e); return "" }
        }
        return ""
    }
}

