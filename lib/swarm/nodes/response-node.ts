import { venice } from '@/lib/venice'
import type { SwarmState } from '../types'

export async function responseNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const { userMessage, contexts, settings, history } = state

    // Assembler le prompt final
    const systemPrompt = `${contexts.persona || ''}

${contexts.style || ''}

${contexts.phase || ''}

${contexts.timing || ''}

${contexts.memory || ''}

${contexts.payment || ''}`

    // DEBUG: Log ce qui est envoyé
    console.log('[Swarm][Response] System prompt length:', systemPrompt.length)
    console.log('[Swarm][Response] Style context:', contexts.style?.substring(0, 200) || 'EMPTY')

    try {
        const response = await venice.chatCompletion(
            systemPrompt,
            [...history.slice(-3), { role: 'user', content: userMessage }],
            '',
            {
                apiKey: settings.venice_api_key,
                model: 'venice-uncensored',
                temperature: 0.7,
                max_tokens: 100
            }
        )

        console.log('[Swarm][Response] Raw response:', response)
        return { response: response.trim() }

    } catch (error: any) {
        console.error('[Swarm][Response] Error:', error)
        return { response: 'jsuis là' }
    }
}
