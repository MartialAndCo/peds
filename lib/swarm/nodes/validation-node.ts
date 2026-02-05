// Agent "Validation" - Vérifie la cohérence et régénère si besoin
import { venice } from '@/lib/venice'
import type { SwarmState } from '../types'

export async function validationNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const { response, history, settings, userMessage, contexts } = state
    
    if (!response) return {}
    
    console.log('[Swarm][Validation] Analyzing response coherence...')
    
    const MAX_RETRIES = 3
    let currentResponse = response
    let attempts = 0
    
    while (attempts < MAX_RETRIES) {
        attempts++
        
        // Construire l'historique récent (5-10 derniers messages)
        const recentHistory = history.slice(-10)
        const historyText = recentHistory
            .map(h => `${h.role === 'user' ? 'LUI' : 'MOI'}: ${h.content}`)
            .join('\n')
        
        const validationPrompt = `Tu es un superviseur strict qui vérifie la cohérence d'une réponse.

CONTEXTE:
- Je suis Anaïs, 14 ans, ado française
- Style: langage ado, abréviations, court (3-6 mots)
- Pas de phrases complètes, pas de virgules

HISTORIQUE RÉCENT (5-10 derniers messages):
${historyText}

MESSAGE QU'IL VIENT DE M'ENVOYER:
"${userMessage}"

MA RÉPONSE À VÉRIFIER:
"${currentResponse}"

VÉRIFICATIONS:
1. La réponse est-elle cohérente avec l'historique ? (pas de rupture brutale)
2. Est-ce que je répète ce que j'ai déjà dit dans les 5 derniers messages ?
3. Le style est-il adolescent ? (court, abréviations, pas formel)
4. Est-ce que je dis quelque chose de bizarre/inattendu sans contexte ?
5. Y a-t-il des contradictions avec ce que j'ai dit avant ?

Réponds UNIQUEMENT en JSON:
{
  "isValid": boolean,
  "issues": string[],
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "suggestion": string | null
}

RÈGLES:
- CRITICAL: Réponse complètement hors sujet, répétition exacte, contradiction flagrante
- HIGH: Style trop formel, longueur > 10 mots, incohérence mineure
- MEDIUM: Petite répétition, style un peu robotique`;

        try {
            const validation = await venice.chatCompletion(
                validationPrompt,
                [],
                'Validation réponse',
                {
                    apiKey: settings.venice_api_key,
                    model: 'venice-uncensored',
                    temperature: 0.1,
                    max_tokens: 300
                }
            )
            
            const cleanJson = validation
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim()
            
            const result = JSON.parse(cleanJson)
            
            console.log(`[Swarm][Validation] Attempt ${attempts}:`, {
                isValid: result.isValid,
                severity: result.severity,
                issues: result.issues
            })
            
            if (result.isValid) {
                console.log('[Swarm][Validation] ✅ Response is valid')
                return { response: currentResponse }
            }
            
            // Problème détecté, on régénère
            console.log(`[Swarm][Validation] ❌ Issues detected (${result.severity}), regenerating...`)
            
            const correctionPrompt = `${contexts.persona || ''}

${contexts.style || ''}

${contexts.phase || ''}

⚠️ CORRECTION NÉCESSAIRE:
Ma précédente réponse avait ces problèmes:
${result.issues?.map((i: string) => `- ${i}`).join('\n') || '- Problème de cohérence'}

${result.suggestion ? `Suggestion: ${result.suggestion}` : ''}

INTERDICTION ABSOLUE:
- Ne RÉPÈTE pas ce que j'ai déjà dit dans les messages précédents
- Ne dis pas "comme je disais" ou "j'ai déjà dit"
- Varie complètement la réponse

Historique récent:
${historyText}

Nouveau message de lui: "${userMessage}"`;

            currentResponse = await venice.chatCompletion(
                correctionPrompt,
                history.slice(-5),
                '',
                {
                    apiKey: settings.venice_api_key,
                    model: 'venice-uncensored',
                    temperature: 0.9, // Plus haut pour varier
                    max_tokens: 50
                }
            )
            
            currentResponse = currentResponse.trim()
            
        } catch (error: any) {
            console.error('[Swarm][Validation] Error:', error.message)
            // En cas d'erreur, on retourne la réponse originale
            return { response: currentResponse }
        }
    }
    
    console.log(`[Swarm][Validation] Max retries (${MAX_RETRIES}) reached, returning best attempt`)
    return { response: currentResponse }
}
