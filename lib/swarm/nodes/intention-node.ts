// Agent "Intention" - Détecte ce que veut l'utilisateur
import { venice } from '@/lib/venice'
import type { SwarmState, IntentionResult } from '../types'

export async function intentionNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const { userMessage, history, settings } = state

    console.log('[Swarm][Intention] Analyzing user message...')

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
}

RÈGLES:
- "paiement": Parle d'argent, PayPal, veut/envoie de l'argent
- "photo": Demande une photo, image, selfie
- "vocal": Demande un vocal, audio, note vocale
- "personnel": Question sur le passé, la vie, la famille
- "general": Discussion normale
- "multi": Plusieurs intentions dans le même message

EXEMPLES:
- "Tu fais quoi ?" → intention: "general", besoinTiming: true
- "Tu peux m'envoyer une photo ?" → intention: "photo", besoinMedia: true
- "Je peux t'envoyer 50€" → intention: "paiement", sousIntention: "offre", besoinPayment: true
- "J'ai envoyé 10K" / "I just sent money" → intention: "paiement", sousIntention: "confirmation", besoinPayment: true, urgence: "high"
- "Appelle-moi" → intention: "vocal", besoinVoice: true
- "Ton chat s'appelle comment ?" → intention: "personnel", besoinMemoire: true`

    // Utiliser google-gemma-3-27b-it (non censuré et fiable)
    const model = 'google-gemma-3-27b-it'
    
    try {
        console.log(`[Swarm][Intention] Using model: ${model}`)
        
        const response = await venice.chatCompletion(
            prompt,
            history.slice(-10),
            'Analyse',
            {
                apiKey: settings.venice_api_key,
                model,
                temperature: 0.1,
                max_tokens: 300
            }
        )

        // Nettoyer la réponse JSON
        const cleanJson = response
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim()

        const intention: IntentionResult = JSON.parse(cleanJson)

        console.log(`[Swarm][Intention] Detected:`, intention.intention, '| urgency:', intention.urgence)

        return { intention }

    } catch (error: any) {
        console.warn(`[Swarm][Intention] Failed:`, error.message)
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
        }
    }
}
