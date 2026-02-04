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
- "Appelle-moi" → intention: "vocal", besoinVoice: true
- "Ton chat s'appelle comment ?" → intention: "personnel", besoinMemoire: true`

    // Essayer d'abord avec llama-3.3-70b (plus rapide pour la classification)
    // Si restriction/refus → fallback sur venice-uncensored
    const modelsToTry = [
        settings.venice_model || 'llama-3.3-70b',
        'venice-uncensored'
    ]
    
    let lastError: any
    
    for (const model of modelsToTry) {
        try {
            console.log(`[Swarm][Intention] Trying model: ${model}`)
            
            const response = await venice.chatCompletion(
                prompt,
                history.slice(-3),
                'Analyse l\'intention',
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

            console.log(`[Swarm][Intention] Detected with ${model}:`, intention)

            return { intention }

        } catch (error: any) {
            console.warn(`[Swarm][Intention] Failed with ${model}:`, error.message)
            lastError = error
            
            // Si c'est une erreur de restriction/parsing, on continue au modèle suivant
            // Sinon on throw direct
            if (!error.message?.includes('restriction') && 
                !error.message?.includes('refused') &&
                !error.message?.includes('JSON')) {
                break
            }
        }
    }
    
    // Tous les modèles ont échoué → fallback général
    console.error('[Swarm][Intention] All models failed, using fallback:', lastError)

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
