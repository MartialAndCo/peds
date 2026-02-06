import { prisma } from '@/lib/prisma'
import type { SwarmState } from '../types'

export async function personaNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const { agentId } = state

    console.log('[Swarm][Persona] Fetching persona for agent:', agentId)

    const profile = await prisma.agentProfile.findUnique({
        where: { agentId },
        select: { contextTemplate: true, identityTemplate: true }
    })

    console.log('[Swarm][Persona] Found:', profile ? 'YES' : 'NO')

    // Déterminer la plateforme et l'âge pour remplacement
    const platformName = state.platform === 'discord' ? 'Discord' : 'WhatsApp'
    const agentAge = profile?.baseAge || 15
    
    // Fonction de remplacement des variables
    const replaceVars = (text: string) => text
        .replace(/\{\{PLATFORM\}\}/g, platformName)
        .replace(/\{\{AGE\}\}/g, agentAge.toString())
    
    // Combiner identity et context pour avoir une persona complète
    let persona = ''
    if (profile?.identityTemplate) {
        // Nettoyer l'identity (supprimer la partie "Tu es une EXPERTE...")
        const identityClean = profile.identityTemplate
            .replace(/Tu es une EXPERTE en conversation naturelle qui incarne Anaïs, 14 ans\./, '')
            .replace(/Un amateur se répète[\s\S]*?Si non → reformule\./, '')
        persona += replaceVars(identityClean)
    }
    if (profile?.contextTemplate) {
        if (persona) persona += '\n\n'
        persona += replaceVars(profile.contextTemplate)
    }

    return {
        contexts: {
            ...state.contexts,
            persona: persona || ''
        }
    }
}
