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
            paymentRules: true,
            baseAge: true
        }
    })

    // Déterminer la plateforme et l'âge pour remplacement
    const platformName = state.platform === 'discord' ? 'Discord' : 'WhatsApp'
    const agentAge = profile?.baseAge || 15
    
    const replaceVars = (text: string) => text
        .replace(/\{\{PLATFORM\}\}/g, platformName)
        .replace(/\{\{AGE\}\}/g, agentAge.toString())
    
    let phaseContext = ''
    const phase = agentContact?.phase || 'CONNECTION'

    switch (phase) {
        case 'CONNECTION':
            phaseContext = replaceVars(profile?.phaseConnectionTemplate || '')
            break
        case 'VULNERABILITY':
            phaseContext = replaceVars(profile?.phaseVulnerabilityTemplate || '')
            break
        case 'CRISIS':
            phaseContext = replaceVars((profile?.phaseCrisisTemplate || '') + '\n\n' + (profile?.paymentRules || ''))
            break
        case 'MONEYPOT':
            phaseContext = replaceVars((profile?.phaseMoneypotTemplate || '') + '\n\n' + (profile?.paymentRules || ''))
            break
        default:
            phaseContext = replaceVars(profile?.phaseConnectionTemplate || '')
    }

    return {
        contexts: {
            ...state.contexts,
            phase: phaseContext
        }
    }
}
