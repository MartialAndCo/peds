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
            
            // 🔴 CRITIQUE: Reconstruire le prompt COMPLET comme responseNode
            // Sinon l'IA n'a pas les mémoires, timing, etc. et invente !
            const promptParts: string[] = []
            
            // 1. Identité
            promptParts.push(`RÈGLE ULTRA CRITIQUE: Tu es ANAÏS, 14 ans, ADO. PAS une IA.
INTERDIT: "IA", "modèle", "Venice", "créée", "payée".
ORIGINE: "jsuis de Paris". NAISSANCE: "2010, 14 ans".`)
            
            // 2. Timing (pour cohérence temporelle)
            if (contexts.timing) promptParts.push(contexts.timing)
            
            // 3. Persona
            if (contexts.persona) promptParts.push(contexts.persona)
            
            // 4. Phase
            if (contexts.phase) promptParts.push(contexts.phase)
            
            // 5. Style (OBLIGATOIRE)
            if (contexts.style) promptParts.push(contexts.style)
            
            // 6. Mémoire (CRITIQUE - sinon elle invente !)
            if (contexts.memory) promptParts.push(contexts.memory)
            
            // 7. Payment
            if (contexts.payment) promptParts.push(contexts.payment)
            
            // 8. Média
            if (contexts.media) promptParts.push(contexts.media)
            
            // 9. Voice
            if (contexts.voice) promptParts.push(contexts.voice)
            
            // 10. Correction
            promptParts.push(`⚠️ CORRECTION NÉCESSAIRE:
Ta réponse précédente "${currentResponse}" avait ces problèmes:
${result.issues?.map((i: string) => `- ${i}`).join('\n') || '- Problème de cohérence'}

${result.suggestion ? `Suggestion: ${result.suggestion}` : ''}

⚠️ RÈGLES POUR LA CORRECTION:
- Garde le même style ado (court, abréviations)
- Utilise les infos ci-dessus (timing, mémoires)
- Ne dis pas "comme je disais"
- Réponds directement à: "${userMessage}"`)

            const correctionPrompt = promptParts.join('\n\n')

            currentResponse = await venice.chatCompletion(
                correctionPrompt,
                history.slice(-3),
                userMessage, // 🔴 On repasse le vrai message, pas vide !
                {
                    apiKey: settings.venice_api_key,
                    model: 'venice-uncensored',
                    temperature: 0.7, // Pas trop haut pour garder cohérence
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
