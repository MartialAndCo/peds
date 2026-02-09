import { storyManager } from '@/lib/engine'
import type { SwarmState } from '../types'

export async function phaseNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const { agentId, contactId, currentPhase, profile } = state

    // 🔥 OPTIMISATION: Utiliser la phase déjà récupérée dans index.ts
    // Plus besoin de requêter AgentContact ici!
    const phase = currentPhase || 'CONNECTION'

    // Déterminer la plateforme et l'âge pour remplacement
    const platformName = state.platform === 'discord' ? 'Discord' : 'WhatsApp'
    const agentAge = profile?.baseAge || 15
    
    const replaceVars = (text: string) => text
        .replace(/\{\{PLATFORM\}\}/g, platformName)
        .replace(/\{\{AGE\}\}/g, agentAge.toString())
    
    let phaseContext = ''

    // 🔥 NOUVEAU : Gestion des Stories pour phases avancées
    if (phase === 'VULNERABILITY' || phase === 'CRISIS' || phase === 'MONEYPOT') {
        try {
            // 1. Récupérer ou créer la story
            let storyContext = await storyManager.getStoryContextForPrompt(contactId, agentId)
            
            // 2. Si pas de story active, créer selon la phase
            if (!storyContext.activeStory) {
                if (phase === 'VULNERABILITY') {
                    // Première story : FACTURE ou FAMILLE
                    await storyManager.createStory(contactId, agentId, 'FACTURE')
                } else if (phase === 'CRISIS') {
                    // Suite de la story précédente ou nouvelle
                    await storyManager.createStory(contactId, agentId)
                } else if (phase === 'MONEYPOT') {
                    // MONEYPOT : rotation des sujets
                    const types = ['SANTE', 'URGENCE', 'FAMILLE', 'ECOLE'] as const
                    const randomType = types[Math.floor(Math.random() * types.length)]
                    await storyManager.createStory(contactId, agentId, randomType)
                }
                
                // Recharger après création
                storyContext = await storyManager.getStoryContextForPrompt(contactId, agentId)
            }
            
            // 3. Construire le contexte avec la story
            const activeStory = storyContext.activeStory
            
            if (activeStory) {
                // Template de base + Story spécifique
                const baseTemplate = replaceVars(
                    phase === 'VULNERABILITY' ? profile?.phaseVulnerabilityTemplate || '' :
                    phase === 'CRISIS' ? (profile?.phaseCrisisTemplate || '') :
                    (profile?.phaseMoneypotTemplate || '')
                )
                
                // Anti-répétition : liste des stories déjà payées
                const resolvedBlock = storyContext.resolvedStories.length > 0 
                    ? `\n\n🚫 STORIES DÉJÀ PAYÉES (NE JAMAIS RÉUTILISER):\n${storyContext.resolvedStories.map(r => `- ${r}`).join('\n')}`
                    : ''
                
                // Story active avec contexte
                const storyBlock = `\n\n📖 STORY ACTIVE (À DÉVELOPPER):\n` +
                    `- Type: ${activeStory.storyType}\n` +
                    `- Problème: ${activeStory.description}\n` +
                    `- Angle: ${activeStory.angle}\n` +
                    `${activeStory.previousStoryDescription ? `- Suite de: ${activeStory.previousStoryDescription}\n` : ''}` +
                    `- Contenu: "${activeStory.promptTemplate}"\n` +
                    `${activeStory.amount ? `- Si demande d'argent: ${activeStory.amount}€ (attends qu'il propose ou demande subtilement)\n` : ''}`
                
                // Cooldown info
                const cooldownBlock = !storyContext.canAskForMoney && activeStory.amount
                    ? `\n\n⏱️ COOLDOWN: Dernière demande récente, ne pas demander d'argent maintenant. Juste maintenir la story.`
                    : ''
                
                phaseContext = baseTemplate + resolvedBlock + storyBlock + cooldownBlock
                
                // Mettre à jour le lastMentioned
                await storyManager.updateLastMentioned(activeStory.id)
            } else {
                // Fallback si pas de story
                phaseContext = replaceVars(
                    phase === 'VULNERABILITY' ? profile?.phaseVulnerabilityTemplate || '' :
                    phase === 'CRISIS' ? (profile?.phaseCrisisTemplate || '') :
                    (profile?.phaseMoneypotTemplate || '')
                )
            }
            
        } catch (error) {
            console.error('[PhaseNode] Error with story system:', error)
            // Fallback sur template standard
            phaseContext = replaceVars(
                phase === 'VULNERABILITY' ? profile?.phaseVulnerabilityTemplate || '' :
                phase === 'CRISIS' ? (profile?.phaseCrisisTemplate || '') :
                (profile?.phaseMoneypotTemplate || '')
            )
        }
    } else {
        // CONNECTION : template standard sans story
        phaseContext = replaceVars(profile?.phaseConnectionTemplate || '')
    }

    // Ajouter payment rules pour CRISIS et MONEYPOT
    if (phase === 'CRISIS' || phase === 'MONEYPOT') {
        phaseContext += '\n\n' + replaceVars(profile?.paymentRules || '')
    }

    return {
        contexts: {
            ...state.contexts,
            phase: phaseContext
        }
    }
}
