import axios from 'axios'

export const venice = {
    async chatCompletion(systemPrompt: string, messages: { role: string, content: string }[], userMessage: string, config: { apiKey?: string, model?: string, temperature?: number, max_tokens?: number, frequency_penalty?: number } = {}) {
        const apiKey = config.apiKey || process.env.VENICE_API_KEY
        if (!apiKey) {
            console.warn('VENICE_API_KEY not configured')
            return "IA non configurée (Clé API manquante)"
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
                if (attempt > 1) console.log(`[Venice] Retry attempt ${attempt}/${MAX_RETRIES}...`)

                console.log(`[Venice] Sending request. Model: ${model}. Context: ${apiMessages.length} msgs. KeyPrefix: ${apiKey.substring(0, 5)}...`)
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

                return response.data.choices[0]?.message?.content || ""

            } catch (error: any) {
                const status = error.response?.status
                const detail = error.response ? `${status} - ${JSON.stringify(error.response.data)}` : error.message
                console.error(`[Venice] Attempt ${attempt} failed:`, detail)

                // If fatal error (Auth / Bad Request), stop immediately
                // User reports 402 is flaky, so we retry it. 401/403 are usually permanent.
                if (status === 400 || status === 401 || status === 403) {
                    return "";
                }

                // If last attempt, return empty
                if (attempt === MAX_RETRIES) return ""

                // Wait before retry (Exponential Backoff: 1s, 2s, 4s)
                const delay = 1000 * Math.pow(2, attempt - 1)
                await new Promise(r => setTimeout(r, delay))
            }
        }
        return ""
    }
}
