type ChatMessage = { role: string; content: string }

type ChatConfig = {
    apiKey?: string
    model?: string
    temperature?: number
    max_tokens?: number
}

type AnthropicContentBlock = {
    type: string
    text?: string
}

type AnthropicResponse = {
    content?: AnthropicContentBlock[]
}

export const anthropic = {
    async chatCompletion(
        systemPrompt: string,
        messages: ChatMessage[],
        userMessage: string,
        config: ChatConfig = {}
    ) {
        const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
            console.warn('ANTHROPIC_API_KEY not configured')
            return 'IA non configuree (Cle API manquante)'
        }

        const model = config.model || 'claude-3-opus-20240229'

        const anthropicMessages = messages.map((m) => ({
            role: (m.role === 'ai' || m.role === 'assistant') ? 'assistant' : 'user',
            content: m.content
        }))

        anthropicMessages.push({ role: 'user', content: userMessage })

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model,
                    max_tokens: config.max_tokens || 1024,
                    temperature: config.temperature ?? 0.7,
                    system: systemPrompt,
                    messages: anthropicMessages
                })
            })

            if (!response.ok) {
                const errBody = await response.text()
                console.error(`[Anthropic] HTTP ${response.status}: ${errBody}`)
                return ''
            }

            const data = await response.json() as AnthropicResponse
            const textBlock = (data.content || []).find((block) => block.type === 'text' && typeof block.text === 'string')
            return textBlock?.text || ''
        } catch (error: unknown) {
            console.error('Anthropic AI Error:', error)
            return ''
        }
    }
}
