import { storyManager } from '@/lib/engine'
import type { SwarmState } from '../types'

export async function phaseNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const { agentId, contactId, currentPhase, profile } = state

    // 🔥 OPTIMISATION: Utiliser la phase déjà récupérée dans index.ts
    // Plus besoin de requêter AgentContact ici!
    const phase = currentPhase || 'CONNECTION'

    // 🔥 WAR MODE INTERCEPTION
    if (phase.startsWith('WAR_')) {
        let warContext = ''
        if (phase === 'WAR_1') warContext = state.settings.war_mode_phase_1_template || ''
        else if (phase === 'WAR_2') warContext = state.settings.war_mode_phase_2_template || ''
        else if (phase === 'WAR_3') {
            warContext = state.settings.war_mode_phase_3_template || ''

            // Inject Links and Media metadata into the prompt for Phase 3
            if (state.warModeLinks && state.warModeLinks.length > 0) {
                warContext += `\n\n[INSTRUCTION WAR MODE 3 - EXTRÊMEMENT IMPORTANT]:\nTu DOIS impérativement donner ce(s) lien(s) à l'utilisateur dans ta prochaine réponse de façon naturelle:\n${state.warModeLinks.map(l => `- ${l}`).join('\n')}`
            }

            if (state.warModeMedia && state.warModeMedia.length > 0) {
                warContext += `\n\n[INSTRUCTION WAR MODE 3 - MEDIA ATTACHÉ]:\n${state.warModeMedia.length} média(s) visuel(s) (photo/vidéo) va être envoyé avec ton message. Tu DOIS y faire référence dans ton texte (ex: "tiens regarde", "je te montre", etc.).`
            }
        }

        const platformName = state.platform === 'discord' ? 'Discord' : 'WhatsApp'
        const agentAge = profile?.baseAge || 15

        const finalWarContext = warContext
            .replace(/\{\{PLATFORM\}\}/g, platformName)
            .replace(/\{\{AGE\}\}/g, agentAge.toString())

        return {
            contexts: {
                ...state.contexts,
                phase: finalWarContext
            }
        }
    }

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

            // Déterminer la locale de l'agent
            const locale = profile?.locale || 'fr-FR'

            // 2. Si pas de story active, créer selon la phase
            if (!storyContext.activeStory) {
                if (phase === 'VULNERABILITY') {
                    // Première story : FACTURE ou FAMILLE
                    await storyManager.createStory(contactId, agentId, 'FACTURE', locale)
                } else if (phase === 'CRISIS') {
                    // Suite de la story précédente ou nouvelle
                    await storyManager.createStory(contactId, agentId, undefined, locale)
                } else if (phase === 'MONEYPOT') {
                    // MONEYPOT : rotation des sujets
                    const types = ['SANTE', 'URGENCE', 'FAMILLE', 'ECOLE'] as const
                    const randomType = types[Math.floor(Math.random() * types.length)]
                    await storyManager.createStory(contactId, agentId, randomType, locale)
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

    return {
        contexts: {
            ...state.contexts,
            phase: phaseContext
        }
    }
}
