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
    async chatCompletion(
        systemPrompt: string,
        messages: { role: string, content: string }[],
        userMessage: string,
        config: { apiKey?: string; model?: string; temperature?: number; max_tokens?: number } = {}
    ): Promise<string> {
        let apiKey = config.apiKey || process.env.RUNPOD_API_KEY

        if (!apiKey) {
            // Try fetching from DB settings
            try {
                const settings = await settingsService.getSettings()
                // Access using index signature or known key if typed
                apiKey = (settings as any).runpod_api_key
                console.log(`[RunPod] Loaded API Key from Settings: ${apiKey ? 'Yes' : 'No'}`)
            } catch (e) {
                console.error('[RunPod] Failed to load settings:', e)
            }
        }

        if (!apiKey) {
            console.warn('[RunPod] RUNPOD_API_KEY not configured')
            return "IA non configurée (RunPod API Key manquante)"
        }

        // Construct message history
        const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: m.content
            })),
            { role: 'user', content: userMessage }
        ]

        try {
            console.log('[RunPod] Sending request to serverless endpoint...')

            // Submit the job to RunPod
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
                timeout: 10000 // 10s for initial submission
            })

            const jobId = response.data?.id
            if (!jobId) {
                console.error('[RunPod] No job ID returned:', response.data)
                return ""
            }

            console.log(`[RunPod] Job submitted: ${jobId}. Polling for result...`)

            // Poll for completion (max 60s with 2s intervals)
            const maxPolls = 30
            for (let i = 0; i < maxPolls; i++) {
                await new Promise(r => setTimeout(r, 2000)) // Wait 2s between polls

                const statusResponse = await axios.get(`${RUNPOD_STATUS_ENDPOINT}/${jobId}`, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    },
                    timeout: 5000
                })

                const status = statusResponse.data?.status
                console.log(`[RunPod] Poll ${i + 1}/${maxPolls}: Status = ${status}`)

                if (status === 'COMPLETED') {
                    const output = statusResponse.data?.output

                    // Handle Array output (e.g. ["{\"id\":...}"])
                    if (Array.isArray(output) && output.length > 0) {
                        // Check if it's an array of strings that are actually JSON
                        if (typeof output[0] === 'string') {
                            try {
                                // Try parsing the string as JSON
                                const parsed = JSON.parse(output[0])
                                if (parsed.choices?.[0]?.message?.content) {
                                    const content = parsed.choices[0].message.content
                                    console.log(`[RunPod] Response received (Parsed JSON) (${content.length} chars)`)
                                    return content
                                }
                            } catch (e) {
                                // Not JSON, maybe just text?
                                console.log('[RunPod] Array[0] is not JSON, returning as text')
                                return output[0]
                            }
                        }
                    }

                    // Handle different output formats
                    if (typeof output === 'string') {
                        try {
                            // It might be a JSON string itself
                            const parsed = JSON.parse(output)
                            if (parsed.choices?.[0]?.message?.content) {
                                return parsed.choices[0].message.content
                            }
                        } catch (e) { }

                        console.log(`[RunPod] Response received (${output.length} chars)`)
                        return output
                    }
                    if (output?.text) {
                        console.log(`[RunPod] Response received (${output.text.length} chars)`)
                        return output.text
                    }
                    if (output?.content) {
                        console.log(`[RunPod] Response received (${output.content.length} chars)`)
                        return output.content
                    }
                    if (output?.choices?.[0]?.message?.content) {
                        const content = output.choices[0].message.content
                        console.log(`[RunPod] Response received (${content.length} chars)`)
                        return content
                    }
                    console.warn('[RunPod] Completed but unknown output format:', output)
                    return ""
                }


                if (status === 'FAILED') {
                    console.error('[RunPod] Job failed:', statusResponse.data?.error)
                    return ""
                }

                if (status === 'CANCELLED') {
                    console.warn('[RunPod] Job was cancelled')
                    return ""
                }

                // Continue polling for IN_QUEUE, IN_PROGRESS
            }

            console.error('[RunPod] Job timed out after polling')
            return ""

        } catch (error: any) {
            const detail = error.response ? `${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message
            console.error(`[RunPod] Request failed: ${detail}`)
            logger.error('RunPod AI request failed', error, { module: 'runpod', detail })
            return ""
        }
    }
}
