// lib/director.ts - STUB pour compatibilité
// 🔥 MIGRATION: Director legacy archivé - Utiliser SWARM uniquement
// Date: 2026-02-07

import { signalAnalyzer, signalAnalyzerV2 } from './services/signal-analyzer-v2'

export type AgentPhase = 'CONNECTION' | 'VULNERABILITY' | 'CRISIS' | 'MONEYPOT'

export const director = {
    /**
     * ⚠️ DEPRECATED: Utiliser le SWARM directement
     * Cette fonction est conservée pour compatibilité mais ne retourne pas de prompt
     */
    async buildSystemPrompt(): Promise<null> {
        console.warn('[Director] ⚠️ DEPRECATED: buildSystemPrompt() called but Director is archived. Use SWARM.')
        return null  // Force l'utilisation du SWARM
    },

    /**
     * Détermine la phase actuelle (encore utilisé par le SWARM)
     */
    async determinePhase(contactPhone: string, agentId: string) {
        const { prisma } = await import('./prisma')
        
        const contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: contactPhone }
        })

        if (!contact) throw new Error('Contact not found')

        const agentContact = await prisma.agentContact.findUnique({
            where: {
                agentId_contactId: {
                    agentId,
                    contactId: contact.id
                }
            }
        })

        const phase = (agentContact?.phase || 'CONNECTION') as AgentPhase
        const signals = (agentContact?.signals || []) as any[]

        return {
            phase,
            details: {
                signals,
                signalCount: signals.length,
                trustScore: agentContact?.trustScore || 0
            },
            reason: signals.length > 0 ? `Signals: [${signals.join(', ')}]` : 'No signals yet'
        }
    },

    /**
     * 🔥 Analyse des signaux V2 avec TTL et régression
     */
    async performSignalAnalysis(contactPhone: string, agentId: string) {
        const { prisma } = await import('./prisma')
        
        const contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: contactPhone }
        })
        
        if (!contact) return null

        return signalAnalyzerV2.updateSignals(agentId, contact.id)
    },

    /**
     * 🔥 NOUVEAU: Récupère les signaux avec métadonnées TTL
     */
    async getSignalAnalysis(contactPhone: string, agentId: string) {
        const { prisma } = await import('./prisma')
        
        const contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: contactPhone }
        })
        
        if (!contact) return null

        return signalAnalyzerV2.analyzeWithTTL(agentId, contact.id)
    }
}
