import { venice } from '@/lib/venice'
import type { SwarmState } from '../types'

export async function responseNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const { userMessage, contexts, settings, history, isBlacklisted } = state

    // Si blacklisté → REFUS DIRECT (sauf si offre de paiement EXPLICITE dans l'historique récent)
    if (isBlacklisted) {
        const msgLower = userMessage.toLowerCase();
        const historyText = history.slice(-3).map((m: any) => m.content).join(' ').toLowerCase();
        const fullContext = msgLower + ' ' + historyText;
        
        // Vérifier s'il y a une vraie offre de paiement (chiffre + monnaie OU proposition claire)
        const hasExplicitPaymentOffer = 
            /\d+\s*(€|euro|dollar|\$)/.test(fullContext) ||  // "50€", "100 euros"
            /je (te )?(paye|donne|envoie)\s*\d+/.test(fullContext) ||  // "je te paye 50"
            /je peux t'envoyer/.test(fullContext) && /\d+/.test(fullContext);  // "je peux t'envoyer 50"
        
        if (!hasExplicitPaymentOffer) {
            // REFUS DIRECT sans appel API
            const refusals = [
                "Nan j'fais pas ça",
                "T'es chelou toi",
                "J'suis pas abonnée",
                "Pas pour toi",
                "T'as cru j'allais faire ça ?",
                "Nope",
                "J' montre pas ça",
                "T'es marrant toi"
            ];
            const randomRefusal = refusals[Math.floor(Math.random() * refusals.length)];
            console.log('[Swarm][Response] BLACKLIST - Refus direct:', randomRefusal);
            return { response: randomRefusal };
        }
        
        // Si proposition de paiement explicite → on continue (elle peut négocier)
        console.log('[Swarm][Response] BLACKLIST mais paiement explicite détecté');
    }

    // Assembler le prompt final
    const systemPrompt = `${contexts.persona || ''}

${contexts.style || ''}

${contexts.phase || ''}

${contexts.timing || ''}

${contexts.memory || ''}

${contexts.payment || ''}

${contexts.media || ''}`

    try {
        const response = await venice.chatCompletion(
            systemPrompt,
            [...history.slice(-3), { role: 'user', content: userMessage }],
            '',
            {
                apiKey: settings.venice_api_key,
                model: 'venice-uncensored',
                temperature: 0.7,
                max_tokens: 20
            }
        )

        return { response: response.trim() }

    } catch (error: any) {
        console.error('[Swarm][Response] Error:', error)
        return { response: 'jsuis là' }
    }
}
