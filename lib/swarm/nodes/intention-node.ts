import { venice } from '@/lib/venice'
import type { IntentionResult, SwarmState } from '../types'

function hasAny(message: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message))
}

export function deterministicIntentClassifier(input: string): IntentionResult {
  const message = (input || '').toLowerCase().trim()

  const paymentPatterns = [
    /\b(pay|paid|payment|paypal|venmo|cashapp|zelle|virement|bank transfer|argent|money|\$|€)\b/i,
    /\b(sent|envoye|envoyé|transfer|viré|vire)\b/i
  ]
  const mediaPatterns = [
    /\b(photo|pic|picture|image|selfie|snap|show (me|your)|montre|envoie une photo)\b/i,
    /\b(feet|foot|face|body|mirror|pied|tete|tête)\b/i
  ]
  const voicePatterns = [
    /\b(voice|vocal|audio|ptt|note vocale|message vocal)\b/i,
    /\b(call me|appelle[- ]?moi|appel)\b/i
  ]
  const personalPatterns = [
    /\b(age|how old|quel age|quel âge|ou habites|où habites|where are you from|name|prenom|prénom|family|famille)\b/i,
    /\b(travail|job|study|ecole|école|school|parents?)\b/i
  ]

  const payment = hasAny(message, paymentPatterns)
  const media = hasAny(message, mediaPatterns)
  const voice = hasAny(message, voicePatterns)
  const personal = hasAny(message, personalPatterns)

  const hitCount = [payment, media, voice, personal].filter(Boolean).length

  let intention: IntentionResult['intention'] = 'general'
  if (hitCount > 1) intention = 'multi'
  else if (payment) intention = 'paiement'
  else if (media) intention = 'photo'
  else if (voice) intention = 'vocal'
  else if (personal) intention = 'personnel'

  const hasQuestion = /\?|\b(comment|pourquoi|quand|where|what|why|how|tu as|did you|can you)\b/i.test(message)
  const hasOffer = /\b(i can|je peux|i will|je vais|i got|j'ai)\b/i.test(message)
  const hasConfirmation = /\b(done|sent|paid|envoye|envoyé|c'?est fait|recu|reçu)\b/i.test(message)

  let sousIntention: IntentionResult['sousIntention'] = 'demande'
  if (hasQuestion) sousIntention = 'question'
  else if (hasConfirmation) sousIntention = 'confirmation'
  else if (hasOffer) sousIntention = 'offre'

  const urgent = /\b(now|urgent|vite|asap|tout de suite|immediately)\b/i.test(message)
  const timing = /\b(now|today|tonight|ce soir|demain|later|apres|après|quand)\b/i.test(message)

  let confidence = 0.45
  if (intention === 'multi') confidence = 0.82
  else if (intention !== 'general') confidence = hitCount >= 1 ? 0.86 : 0.8

  return {
    intention,
    sousIntention,
    urgence: urgent ? 'high' : 'normal',
    besoinTiming: timing || intention === 'general',
    besoinMemoire: intention === 'personnel',
    besoinPhase: intention === 'paiement' || intention === 'multi',
    besoinPayment: intention === 'paiement' || (intention === 'multi' && payment),
    besoinMedia: intention === 'photo' || (intention === 'multi' && media),
    besoinVoice: intention === 'vocal' || (intention === 'multi' && voice),
    confiance: confidence
  }
}

export async function intentionNode(state: SwarmState): Promise<Partial<SwarmState>> {
  const { userMessage, settings } = state
  const metadata = state.metadata || {}

  console.log('[Swarm][Intention] Analyzing user message...')

  const deterministicIntent = deterministicIntentClassifier(userMessage)
  if (deterministicIntent.confiance > 0.8) {
    console.log('[Swarm][Intention] Deterministic fast-path hit:', deterministicIntent.intention)
    return {
      intention: deterministicIntent,
      metadata: {
        ...metadata,
        intentionSource: 'deterministic',
        deterministicIntentConfidence: deterministicIntent.confiance
      }
    }
  }

  const prompt = `Tu es un analyste d'intention de conversation WhatsApp.
Analyse ce message et détermine l'intention principale.

Message utilisateur: """${userMessage}"""

Réponds UNIQUEMENT en JSON valide (sans markdown):
{
  "intention": "paiement" | "photo" | "vocal" | "personnel" | "general" | "multi",
  "sousIntention": "demande" | "offre" | "question" | "refus" | "confirmation",
  "urgence": "high" | "normal" | "low",
  "besoinTiming": true/false,
  "besoinMemoire": true/false,
  "besoinPhase": true/false,
  "besoinPayment": true/false,
  "besoinMedia": true/false,
  "besoinVoice": true/false,
  "confiance": 0.0-1.0
}`

  const model = 'google-gemma-3-27b-it'

  try {
    console.log(`[Swarm][Intention] LLM fallback using model: ${model}`)

    const response = await venice.chatCompletion(prompt, state.messages.slice(-8), 'Analyse', {
      apiKey: settings.venice_api_key,
      model,
      temperature: 0.1,
      max_tokens: 300
    })

    const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim()

    const intention: IntentionResult = JSON.parse(cleanJson)

    console.log('[Swarm][Intention] LLM detected:', intention.intention, '| urgency:', intention.urgence)

    return {
      intention,
      metadata: {
        ...metadata,
        intentionSource: 'llm',
        llmCallsThisTurn: ((metadata.llmCallsThisTurn as number) || 0) + 1
      }
    }
  } catch (error: any) {
    console.warn('[Swarm][Intention] LLM fallback failed:', error.message)
  }

  return {
    intention: {
      intention: 'general',
      urgence: 'normal',
      besoinTiming: true,
      besoinMemoire: false,
      besoinPhase: false,
      besoinPayment: false,
      besoinMedia: false,
      besoinVoice: false,
      confiance: 0.5
    },
    metadata: {
      ...metadata,
      intentionSource: 'fallback'
    }
  }
}
