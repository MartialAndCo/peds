import { prisma } from '@/lib/prisma'
import type { SwarmState } from '../types'

export async function styleNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const { agentId } = state

    console.log('[Swarm][Style] Fetching style for agent:', agentId)

    const profile = await prisma.agentProfile.findUnique({
        where: { agentId },
        select: { styleRules: true }
    })

    console.log('[Swarm][Style] Found:', profile ? 'YES' : 'NO', 'Length:', profile?.styleRules?.length || 0)

    return {
        contexts: {
            ...state.contexts,
            style: profile?.styleRules || ''
        }
    }
}
