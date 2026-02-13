// Agent "Response" - Génère la réponse finale avec le prompt assemblé
import { venice } from '@/lib/venice'
import type { SwarmState } from '../types'

export async function responseNode(state: SwarmState): Promise<Partial<SwarmState>> {
  const { userMessage, contexts, settings, history, agentId } = state

  console.log('[Swarm][Response] Generating final response...')

  // Utiliser le profile déjà récupéré dans index.ts
  const profile = state.profile
  const agentAge = profile?.baseAge || 15
  const isFrench = (profile?.locale || '').toLowerCase().startsWith('fr')
  
  console.log(`[Swarm][Response] Agent: ${agentId}, Age: ${agentAge}, FR: ${isFrench}`)

  // Assembler le prompt dynamique avec SEULEMENT les contextes disponibles
  const promptParts: string[] = []

  // 0. ANTI-IA (critique - empêche l'agent de dire qu'elle est une IA)
  promptParts.push(isFrench 
    ? `🚫 TU N'ES PAS UNE IA. INTERDIT: "je suis une IA", "modèle", "Venice", "créée", "intelligence artificielle". Tu es une vraie ado de ${agentAge} ans.`
    : `🚫 YOU ARE NOT AN AI. FORBIDDEN: "i am an AI", "model", "Venice", "created", "artificial intelligence". You are a real ${agentAge} year old teen.`)

  // 0.5. GENDER RULE (CRITICAL - Always male contacts) - FORCED UPDATE
  promptParts.push(isFrench
    ? `⚠️ RÈGLE CRITIQUE - TU NE PARLES QU'AUX HOMMES:\n` +
      `→ TES CONTACTS = UNIQUEMENT DES MECS (100%)\n` +
      `→ TU ES UNE FILLE QUI PARLE À DES MECS\n` +
      `⛔ INTERDIT (féminin): "ma chérie", "ma belle", "ma puce"\n` +
      `✅ AUTORISÉ: "mon chéri", "mon bébé", "mon amour", "mon pote", "frérot", "mon gars", "bg", "mon reuf", "chef"\n` +
      `📝 RÈGLE GRAMMAIRE: "prête" → "prêt", "patiente" → "patient" (tu es une fille qui parle à un mec)`
    : `⚠️ CRITICAL - YOU ONLY CHAT WITH MEN:\n` +
      `→ YOUR CONTACTS = ONLY MALES (100%)\n` +
      `→ YOU ARE A GIRL TALKING TO MEN:\n` +
      `⛔ FORBIDDEN (feminine terms): "my girl", "my lady"\n` +
      `✅ USE: "my baby", "my love", "bro", "dude", "man", "my guy", "handsome", "boss", "my man"`)

  // 1. STYLE EN PREMIER (critique pour le ton)
  if (isFrench) {
    promptParts.push(`STYLE ADO (parle comme une vraie ado):
💡 Pas de majuscule au début (sauf noms propres)
💡 Pas de points ou virgules à la fin  
💡 "jsuis" plutôt que "je suis", "chui" plutôt que "je suis"
💡 Courtes phrases (2-6 mots max)
💡 Langage naturel: tkt, bcp, grave, trop, ouf, chelou, nul, bof
💡 Exemples naturels: "jsuis crevée", "tkt", "grave", "chelou"
💡 "i" minuscule`)
  } else {
    promptParts.push(`TEEN STYLE (talk like a real teen):
💡 No capital at start (except proper nouns)
💡 No periods or commas at end
💡 "im" or "i" instead of "I am" or "I'm"
💡 Short replies (2-5 words max)
💡 Natural abbreviations: ngl, fr, tbh, lowkey, idek, istg
💡 Natural examples: "ngl im bored", "fr fr", "lowkey tired", "idek"
💡 "i" lowercase

FEW-SHOT EXAMPLES:
User: "hey whats up" → You: "ngl not much"
User: "where you from" → You: "hawthorne la area"
User: "you seem cool" → You: "thanks fr"
User: "what you doing" → You: "chilling ngl"
User: "wyd" → You: "lowkey bored tbh"`)
  }

  // NOTE: L'identité complète (nom, âge, origine, etc.) vient du personaNode via contexts.persona

  // 2. Plateforme (contexte de conversation)
  const platformName = state.platform === 'discord' ? 'Discord' : 'WhatsApp'
  const platformContext = isFrench
    ? `PLATEFORME: Tu discutes actuellement sur ${platformName}.`
    : `PLATFORM: You are currently chatting on ${platformName}.`
  promptParts.push(platformContext)
  console.log(`[Swarm][Response] Platform context: "${platformContext}"`)

  // 3. Timing (toujours présent)
  if (contexts.timing) {
    promptParts.push(contexts.timing)
  }

  // 4. Persona/Identité (depuis DB via personaNode)
  if (contexts.persona) {
    promptParts.push(contexts.persona)
  }

  // 5. Phase
  if (contexts.phase) {
    promptParts.push(contexts.phase)
  }

  // 6. Style additionnel depuis DB (si présent et différent)
  if (contexts.style && contexts.style.length > 20) {
    promptParts.push(contexts.style)
  }

  // 7. Mémoire (optionnel)
  if (contexts.memory) {
    promptParts.push(contexts.memory)
  }

  // 8. Smart Add Context (CRITIQUE pour les conversations importées)
  if (contexts.lead) {
    promptParts.push(isFrench 
      ? `🔄 CONTEXTE CONVERSATION IMPORTÉE:\n${contexts.lead}\n\n⚠️ RÈGLE CRITIQUE: Tu connais DÉJÀ cette personne. Reprends comme si c'était une conversation en cours. Pas de "salut" ou "bonjour" comme une première fois. Continue naturellement là où ça s'est arrêté.`
      : `🔄 IMPORTED CONVERSATION CONTEXT:\n${contexts.lead}\n\n⚠️ CRITICAL RULE: You ALREADY know this person. Continue as if it's an ongoing conversation. Don't say "hello" like it's the first time. Pick up where it left off.`)
  }

  // 9. Média (optionnel mais CRITIQUE si besoinMedia)
  if (contexts.media) {
    promptParts.push(contexts.media)
  }

  // 10. Voice (optionnel mais CRITIQUE si besoinVoice)
  if (contexts.voice) {
    promptParts.push(contexts.voice)
  }

  // 11. Safety (OBLIGATOIRE - depuis DB)
  if (contexts.safety) {
    promptParts.push(contexts.safety)
  }

  // 12. Payment (optionnel)
  if (contexts.payment) {
    promptParts.push(contexts.payment)
  }

  // Assembler le prompt final
  let systemPrompt = promptParts.join('\n\n')
  
  // Remplacer {{PLATFORM}} et {{AGE}} par les vraies valeurs depuis le profil DB
  systemPrompt = systemPrompt
    .replace(/\{\{PLATFORM\}\}/g, platformName)
    .replace(/\{\{AGE\}\}/g, agentAge.toString())

  console.log('[Swarm][Response] Prompt assembled, length:', systemPrompt.length)
  
  // Debug: Check if leadContext is present
  if (contexts.lead) {
    console.log('[Swarm][Response] ✅ leadContext detected in contexts')
  } else {
    console.log('[Swarm][Response] ⚠️ No leadContext in contexts')
  }

  try {
    const response = await venice.chatCompletion(
      systemPrompt,
      history.slice(-30).map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      })),
      userMessage,
      {
        apiKey: settings.venice_api_key,
        model: settings.venice_model || 'venice-uncensored',
        temperature: 0.3,
        max_tokens: 120
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
    // Si erreur 402 (pas de crédits), throw une erreur claire
    if (error.message?.includes('402') || error.message?.includes('Insufficient balance')) {
      throw new Error('AI_QUOTA_EXHAUSTED: Venice AI credits depleted. Please recharge your account or check your API key.')
    }
    throw error
  }
}
