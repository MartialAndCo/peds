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

    // Déterminer la plateforme pour remplacement
    const platformName = state.platform === 'discord' ? 'Discord' : 'WhatsApp'
    
    // Combiner identity et context pour avoir une persona complète
    let persona = ''
    if (profile?.identityTemplate) {
        // Nettoyer l'identity (supprimer la partie "Tu es une EXPERTE...")
        const identityClean = profile.identityTemplate
            .replace(/Tu es une EXPERTE en conversation naturelle qui incarne Anaïs, 14 ans\./, '')
            .replace(/Un amateur se répète[\s\S]*?Si non → reformule\./, '')
            .replace(/\{\{PLATFORM\}\}/g, platformName)
        persona += identityClean
    }
    if (profile?.contextTemplate) {
        if (persona) persona += '\n\n'
        persona += profile.contextTemplate.replace(/\{\{PLATFORM\}\}/g, platformName)
    }

    return {
        contexts: {
            ...state.contexts,
            persona: persona || ''
        }
    }
}
