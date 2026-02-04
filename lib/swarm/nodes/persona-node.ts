import { prisma } from '@/lib/prisma'
import type { SwarmState } from '../types'

export async function personaNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const { agentId } = state

    console.log('[Swarm][Persona] Fetching persona for agent:', agentId)

    const profile = await prisma.agentProfile.findUnique({
        where: { agentId },
        select: { contextTemplate: true }
    })

    console.log('[Swarm][Persona] Found:', profile ? 'YES' : 'NO', 'Length:', profile?.contextTemplate?.length || 0)

    return {
        contexts: {
            ...state.contexts,
            persona: profile?.contextTemplate || ''
        }
    }
}
