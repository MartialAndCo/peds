import axios from 'axios'
import { logger } from './logger'
import { runpod } from './runpod'

export const venice = {
    async chatCompletion(systemPrompt: string, messages: { role: string, content: string }[], userMessage: string, config: { apiKey?: string, model?: string, temperature?: number, max_tokens?: number, frequency_penalty?: number } = {}) {
        const apiKey = config.apiKey || process.env.VENICE_API_KEY
        if (!apiKey) {
            console.warn('VENICE_API_KEY not configured')
            // Fallback to RunPod if Venice is not configured
            console.warn('[Venice] No API key, falling back to RunPod...')
            return await runpod.chatCompletion(systemPrompt, messages, userMessage, {
                temperature: config.temperature,
                max_tokens: config.max_tokens
            })
        }

        const model = config.model || process.env.VENICE_MODEL || 'venice-uncensored'

        // Construct message history: System -> History -> New User Message
        // Note: Venice might expect 'user'/'assistant' roles.
        // Our DB 'sender' is 'ai'/'contact'/'admin'. Mapping needed.

        const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: m.content
            })),
            { role: 'user', content: userMessage }
        ]

        const MAX_RETRIES = 3

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (attempt > 1) logger.info('Venice retry attempt', { module: 'venice', attempt, maxRetries: MAX_RETRIES })

                console.log(`[Venice] Requesting completion (Model: ${model})...`)
                const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
                    model,
                    messages: apiMessages,
                    temperature: config.temperature ?? 0.7,
                    max_tokens: config.max_tokens ?? 500,
                    frequency_penalty: config.frequency_penalty ?? 0.3,
                }, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                })

                const content = response.data.choices[0]?.message?.content || ""
                console.log(`[Venice] Response received (${content.length} chars)`)
                return content

            } catch (error: any) {
                const status = error.response?.status
                const detail = error.response ? `${status} - ${JSON.stringify(error.response.data)}` : error.message
                console.error(`[Venice] Request failed (Attempt ${attempt}): ${detail}`)
                logger.error('Venice AI request failed', error, { module: 'venice', attempt, status, detail })

                // If fatal error (Auth / Bad Request / Payment), fallback to RunPod immediately
                // - 400: Bad Request
                // - 401: Unauthorized
                // - 402: Payment Required (No credits) - Retry is useless, switch to ASYNC JOB
                // - 403: Forbidden
                if (status === 400 || status === 401 || status === 402 || status === 403) {
                    console.warn(`[Venice] Fatal error (${status}). Switching to RunPod ASYNC Job...`)
                    // Async Submission to prevent Lambda timeout
                    const jobId = await runpod.submitJob(systemPrompt, messages, userMessage, {
                        temperature: config.temperature,
                        max_tokens: config.max_tokens
                    })
                    // Throw special error to be caught by chat handler
                    const error = new Error(`RUNPOD_ASYNC_JOB:${jobId}`)
                        (error as any).isAsyncJob = true
                            (error as any).jobId = jobId
                    throw error
                }

                // If last attempt, fallback to RunPod
                if (attempt === MAX_RETRIES) {
                    console.warn(`[Venice] All ${MAX_RETRIES} attempts failed. Falling back to RunPod...`)
                    return await runpod.chatCompletion(systemPrompt, messages, userMessage, {
                        temperature: config.temperature,
                        max_tokens: config.max_tokens
                    })
                }

                // Wait before retry (Exponential Backoff: 1s, 2s, 4s)
                const delay = 1000 * Math.pow(2, attempt - 1)
                await new Promise(r => setTimeout(r, delay))
            }
        }

        // This should not be reached, but fallback to RunPod just in case
        console.warn('[Venice] Unexpected exit from retry loop. Falling back to RunPod...')
        return await runpod.chatCompletion(systemPrompt, messages, userMessage, {
            temperature: config.temperature,
            max_tokens: config.max_tokens
        })
    }
}
