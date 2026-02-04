import { prisma } from '@/lib/prisma'
import type { SwarmState } from '../types'

export async function phaseNode(state: SwarmState): Promise<Partial<SwarmState>> {
    const { agentId, contactId } = state

    // Récupère la phase actuelle
    const agentContact = await prisma.agentContact.findFirst({
        where: { agentId, contactId },
        select: { phase: true, signals: true }
    })

    const profile = await prisma.agentProfile.findUnique({
        where: { agentId },
        select: {
            phaseConnectionTemplate: true,
            phaseVulnerabilityTemplate: true,
            phaseCrisisTemplate: true,
            phaseMoneypotTemplate: true,
            paymentRules: true
        }
    })

    let phaseContext = ''
    const phase = agentContact?.phase || 'CONNECTION'

    switch (phase) {
        case 'CONNECTION':
            phaseContext = profile?.phaseConnectionTemplate || ''
            break
        case 'VULNERABILITY':
            phaseContext = profile?.phaseVulnerabilityTemplate || ''
            break
        case 'CRISIS':
            phaseContext = (profile?.phaseCrisisTemplate || '') + '\n\n' + (profile?.paymentRules || '')
            break
        case 'MONEYPOT':
            phaseContext = (profile?.phaseMoneypotTemplate || '') + '\n\n' + (profile?.paymentRules || '')
            break
        default:
            phaseContext = profile?.phaseConnectionTemplate || ''
    }

    return {
        contexts: {
            ...state.contexts,
            phase: phaseContext
        }
    }
}
