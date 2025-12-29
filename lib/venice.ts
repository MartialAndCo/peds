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

        try {
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
            console.error('Venice AI Error:', error.response?.data || error.message)
            const detail = error.response ? `${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message
            console.error('[Venice] Wrapper Error:', detail);
            // FAIL SAFE: Never return error text to the user.
            // Return empty string to signal failure to the caller.
            return "";
        }
    }
}
