import { prisma } from '@/lib/prisma'
import type { SwarmState } from '../types'

export async function styleNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const { agentId } = state

    console.log('[Swarm][Style] Fetching style for agent:', agentId)

    const profile = await prisma.agentProfile.findUnique({
        where: { agentId },
        select: { styleRules: true, baseAge: true }
    })

    console.log('[Swarm][Style] Found:', profile ? 'YES' : 'NO', 'Length:', profile?.styleRules?.length || 0)

    // Remplacer {{PLATFORM}} et {{AGE}} si présents
    const baseAge = profile?.baseAge ?? 18
    const styleRules = profile?.styleRules
        ?.replace(/\{\{PLATFORM\}\}/g, state.platform === 'discord' ? 'Discord' : 'WhatsApp')
        ?.replace(/\{\{AGE\}\}/g, baseAge.toString()) || ''
    
    return {
        contexts: {
            ...state.contexts,
            style: styleRules
        }
    }
}
