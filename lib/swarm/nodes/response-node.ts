// Agent "Response" - Génère la réponse finale avec le prompt assemblé
import { venice } from '@/lib/venice'
import type { SwarmState } from '../types'

export async function responseNode(state: SwarmState): Promise<Partial<SwarmState>> {
  const { userMessage, contexts, settings, history } = state

  console.log('[Swarm][Response] Generating final response...')

  // Assembler le prompt dynamique avec SEULEMENT les contextes disponibles
  const promptParts: string[] = []

  // 1. Identité (toujours présente)
  promptParts.push(`RÈGLE ULTRA CRITIQUE: Tu es ANAÏS, 14 ans, ADO. PAS une IA.
INTERDIT: "IA", "modèle", "Venice", "créée", "payée".
ORIGINE: "jsuis de Paris". NAISSANCE: "2010, 14 ans".`)

  // 2. Timing (toujours présent)
  if (contexts.timing) {
    promptParts.push(contexts.timing)
  }

  // 3. Persona/Identité
  if (contexts.persona) {
    promptParts.push(contexts.persona)
  }

  // 4. Phase
  if (contexts.phase) {
    promptParts.push(contexts.phase)
  }

  // 5. Style (OBLIGATOIRE pour éviter les paragraphes)
  if (contexts.style) {
    promptParts.push(contexts.style)
  } else {
    // Fallback si style manquant
    promptParts.push(`STYLE OBLIGATOIRE:
- MAX 3-6 mots par message
- Langage ado: abréviations, "jsuis", "tkt", "bcp", "tg"
- Pas de phrases complètes, pas de virgules
- Jamais de majuscules en début (sauf noms propres)
- Émojis naturels, pas trop
- Réponses COURTES et DIRECTES`)
  }

  // 6. Mémoire (optionnel)
  if (contexts.memory) {
    promptParts.push(contexts.memory)
  }

  // 7. Média (optionnel mais CRITIQUE si besoinMedia)
  if (contexts.media) {
    promptParts.push(contexts.media)
  }

  // 8. Voice (optionnel mais CRITIQUE si besoinVoice)
  if (contexts.voice) {
    promptParts.push(contexts.voice)
  }

  // 9. Payment (optionnel)
  if (contexts.payment) {
    promptParts.push(contexts.payment)
  }

  // Assembler le prompt final
  const systemPrompt = promptParts.join('\n\n')

  console.log('[Swarm][Response] Prompt assembled, length:', systemPrompt.length)

  try {
    const response = await venice.chatCompletion(
      systemPrompt,
      history.slice(-3).map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      })),
      userMessage,
      {
        apiKey: settings.venice_api_key,
        model: settings.venice_model || 'venice-uncensored',
        temperature: 0.7,
        max_tokens: 50
      }
    )

    const cleanResponse = response
      .replace(/\n+/g, ' ')
      .replace(/\s*\|\s*/g, ' | ')
      .replace(/\s+/g, ' ')
      .trim()

    console.log('[Swarm][Response] Generated:', cleanResponse.substring(0, 50) + '...')

    return { response: cleanResponse }

  } catch (error: any) {
    console.error('[Swarm][Response] Failed:', error.message)
    return { response: 'jsuis là' }
  }
}
