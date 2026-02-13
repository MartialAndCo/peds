'use server'

import { prisma } from '@/lib/prisma'

export type PipelineStage = 'Nouveau' | 'Discussion' | 'Closing' | 'Clients'

export interface PipelineContact {
    id: string
    name: string | null
    phone: string
    age: string | null
    job: string | null
    location: string | null
    avatarUrl: string | null
    trustScore: number  // DEPRECATED - gardé pour compatibilité
    signals: string[]   // 🔥 NOUVEAU
    daysActive: number
    lastMessage: string
    stage: PipelineStage
    profile: any
    phase: string       // 🔥 NOUVEAU
}

export async function getPipelineData(agentId?: string) {
    const contacts = await prisma.contact.findMany({
        where: {
            status: { notIn: ['blacklisted', 'merged'] },
            source: { notIn: ['system', 'hidden'] }
        },
        include: {
            conversations: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: {
                    messages: {
                        orderBy: { timestamp: 'desc' },
                        take: 1
                    }
                }
            },
            payments: { take: 1 },
            agentContacts: agentId ? {
                where: { agentId },
                take: 1
            } : false
        },
        orderBy: { updatedAt: 'desc' }
    })

    const pipeline: Record<PipelineStage, PipelineContact[]> = {
        'Nouveau': [],
        'Discussion': [],
        'Closing': [],
        'Clients': []
    }

    const now = new Date()

    for (const c of contacts) {
        const profile = c.profile as any || {}
        const daysActive = Math.ceil(Math.abs(now.getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24))

        // 🔥 Récupérer les données agent-spécifiques si disponibles
        const agentContact = c.agentContacts?.[0]
        const phase = agentContact?.phase || c.agentPhase || 'CONNECTION'
        const signals = agentContact?.signals || []

        // Find latest image
        const lastMediaMsg = await prisma.message.findFirst({
            where: { conversation: { contactId: c.id }, mediaUrl: { not: null } },
            orderBy: { timestamp: 'desc' },
            select: { mediaUrl: true }
        })

        const mapped: PipelineContact = {
            id: c.id,
            name: profile.name || c.name || c.phone_whatsapp || 'N/A',
            phone: c.phone_whatsapp || 'N/A',
            age: profile.age || '?',
            job: profile.job || '?',
            location: profile.location || '?',
            avatarUrl: lastMediaMsg?.mediaUrl || null,
            trustScore: 0, // DEPRECATED - masqué dans l'UI
            signals,
            daysActive,
            lastMessage: c.conversations[0]?.messages[0]?.message_text || '',
            stage: 'Nouveau',
            profile,
            phase
        }

        // 🔥 NOUVELLE LOGIQUE: Basée sur phase et signaux (pas trustScore)
        if (c.payments.length > 0) {
            mapped.stage = 'Clients'
        } else if (phase === 'CRISIS' || phase === 'MONEYPOT') {
            mapped.stage = 'Closing'
        } else if (phase === 'VULNERABILITY' || signals.length >= 2) {
            mapped.stage = 'Discussion'
        } else {
            mapped.stage = 'Nouveau'
        }

        pipeline[mapped.stage].push(mapped)
    }

    return pipeline
}
