import Anthropic from '@anthropic-ai/sdk'

export const anthropic = {
    async chatCompletion(systemPrompt: string, messages: { role: string, content: string }[], userMessage: string, config: { apiKey?: string, model?: string, temperature?: number, max_tokens?: number } = {}) {
        const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
            console.warn('ANTHROPIC_API_KEY not configured')
            return "IA non configurée (Clé API manquante)"
        }

        const client = new Anthropic({
            apiKey: apiKey,
        })

        const model = config.model || 'claude-3-opus-20240229' // or claude-3-sonnet...

        // Map messages. Anthropic roles: 'user', 'assistant'.
        // Note: Anthropic system prompt is a top-level parameter, not a message in the array.

        // Previous messages
        const anthropicMessages: any[] = messages.map(m => ({
            role: (m.role === 'ai' || m.role === 'assistant') ? 'assistant' : 'user', // mapping 'ai'/'assistant' -> 'assistant', 'contact'/'user' -> 'user'
            content: m.content
        }))

        // Add current user message
        anthropicMessages.push({ role: 'user', content: userMessage })

        try {
            const response = await client.messages.create({
                model: model,
                max_tokens: config.max_tokens || 1024,
                temperature: config.temperature || 0.7,
                system: systemPrompt,
                messages: anthropicMessages
            })

            // response.content is an array of content blocks. Usually text.
            if (response.content[0].type === 'text') {
                return response.content[0].text
            }
            return ""
        } catch (error: any) {
            console.error('Anthropic AI Error:', error)
            const detail = error.message || JSON.stringify(error)
            console.error('[Anthropic] Wrapper Error:', detail);
            // FAIL SAFE: Never return error text to the user.
            // Return empty string to signal failure to the caller.
            return "";
        }
    }
}
