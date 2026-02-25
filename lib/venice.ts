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

        const model = config.model || process.env.VENICE_MODEL || 'google-gemma-3-27b-it'

        // Construct message history: System -> History -> New User Message
        // Note: Venice accepts 'system' role for system prompts.
        // Our DB 'sender' is 'ai'/'contact'/'admin'. Mapping needed.

        // Validate and sanitize inputs to prevent API rejection
        const sanitizedSystemPrompt = systemPrompt || 'You are a helpful assistant.'
        const sanitizedUserMessage = userMessage || 'Hello'

        // Filter out messages with null/undefined content and map roles
        const validHistoryMessages = messages
            .filter(m => m.content && typeof m.content === 'string')
            .map(m => ({
                role: (m.role === 'ai' || m.role === 'assistant') ? 'assistant' : 'user',
                content: m.content
            }))

        const apiMessages = [
            { role: 'system', content: sanitizedSystemPrompt },
            ...validHistoryMessages,
            { role: 'user', content: sanitizedUserMessage }
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
                    frequency_penalty: config.frequency_penalty ?? 0.7,
                }, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                })

                const content = response.data.choices[0]?.message?.content || ""
                console.log(`[Venice] Response received (${content.length} chars)`)

                // If empty response, log warning but return empty (validator will handle)
                if (!content || content.trim().length === 0) {
                    console.warn('[Venice] WARNING: Empty response from API')
                }

                return content

            } catch (error: any) {
                const status = error.response?.status
                const detail = error.response ? `${status} - ${JSON.stringify(error.response.data)}` : error.message
                console.error(`[Venice] Request failed (Attempt ${attempt}): ${detail}`)
                logger.error('Venice AI request failed', error, { module: 'venice', attempt, status, detail })

                if (status === 400 || status === 401 || status === 402 || status === 403 || status === 404 || status === 405) {
                    // CRITICAL: Venice credits depleted or API rejected
                    console.error(`[Venice] 🚨 API REJECTED (${status}): ${detail}`)
                    logger.error(`Venice API rejected request`, error, { module: 'venice', status, detail })

                    // Throw clear error for upstream handling
                    throw new Error(`VENICE_API_REJECTED:${status}:${detail}`)
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
    },

    async getBillingBalance(apiKeyInput?: string) {
        const apiKey = apiKeyInput || process.env.VENICE_API_KEY
        if (!apiKey) return null

        try {
            const response = await axios.get('https://api.venice.ai/api/v1/billing/balance', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                }
            })
            return response.data
        } catch (error) {
            console.error('[Venice] Failed to fetch billing balance:', error)
            return null
        }
    },

    async getBillingUsage(startDate: Date, endDate: Date, apiKeyInput?: string) {
        const apiKey = apiKeyInput || process.env.VENICE_API_KEY
        if (!apiKey) return null

        try {
            // Determine range to fetch
            const params = new URLSearchParams({
                'startDate': startDate.toISOString(),
                'endDate': endDate.toISOString(),
                'limit': '500' // Max allowed
            })

            let totalSpentUsd = 0
            let allData: any[] = []
            let page = 1
            let totalPages = 1
            const dailyCostsMap: Record<string, number> = {}

            // Support pagination if usages > 500
            do {
                params.set('page', page.toString())
                const response = await axios.get(`https://api.venice.ai/api/v1/billing/usage?${params.toString()}`, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Accept': 'application/json'
                    }
                })

                for (const item of response.data.data) {
                    // Calculate exact USD cost based on units & price per unit.
                    const costUsd = Number(item.pricePerUnitUsd || 0) * Number(item.units || 0)
                    totalSpentUsd += costUsd

                    if (item.timestamp) {
                        try {
                            const d = new Date(item.timestamp)
                            if (!isNaN(d.getTime())) {
                                const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
                                dailyCostsMap[dateStr] = (dailyCostsMap[dateStr] || 0) + costUsd
                            }
                        } catch (e) {
                            // ignore invalid dates
                        }
                    }
                }

                allData = allData.concat(response.data.data)
                totalPages = response.data.pagination?.totalPages || 1
                page++
            } while (page <= totalPages && page <= 10) // Safety break after 10 pages (~5000 records)

            // Pre-fill dailyCosts with ALL dates in the range to ensure empty days show as 0.
            const dailyCosts: { date: string, cost: number }[] = []
            const currDate = new Date(startDate)
            const endLimitDate = new Date(endDate)

            // Reset hours to start of day for comparison
            currDate.setHours(0, 0, 0, 0)
            endLimitDate.setHours(23, 59, 59, 999)

            // Fill empty array first
            while (currDate <= endLimitDate) {
                // Formatting as "MMM DD" (e.g. "Feb 25")
                const dateStr = currDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
                if (!dailyCosts.find(d => d.date === dateStr)) {
                    dailyCosts.push({
                        date: dateStr,
                        cost: 0
                    })
                }
                currDate.setDate(currDate.getDate() + 1)
            }

            // Populate array with actual costs from the map
            for (let i = 0; i < dailyCosts.length; i++) {
                if (dailyCostsMap[dailyCosts[i].date]) {
                    dailyCosts[i].cost = dailyCostsMap[dailyCosts[i].date]
                }
            }

            return {
                totalAmount: totalSpentUsd,
                currency: 'USD',
                recordCount: allData.length,
                dailyCosts
            }
        } catch (error) {
            console.error('[Venice] Failed to fetch billing usage:', error)
            return null
        }
    }
}
