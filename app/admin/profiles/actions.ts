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
    trustScore: number
    daysActive: number
    lastMessage: string
    stage: PipelineStage
    profile: any
}

export async function getPipelineData() {
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
            payments: { take: 1 } // Check for money
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

        // Find latest image (naive check, ideally should query Messages with mediaUrl)
        // Since we can't easily include specific messages in the main query efficiently without complex filters,
        // we'll fetch the latest image separately OR just use the text placeholder for now.
        // For optimization, lets fetch latest media message for this contact.
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
            trustScore: c.trustScore,
            daysActive,
            lastMessage: c.conversations[0]?.messages[0]?.message_text || '',
            stage: 'Nouveau', // Default
            profile
        }

        // Logic
        if (c.payments.length > 0) {
            mapped.stage = 'Clients'
        } else if (c.agentPhase === 'CRISIS' || c.trustScore >= 80) {
            mapped.stage = 'Closing'
        } else if (c.agentPhase === 'VULNERABILITY' || (c.trustScore >= 20 && daysActive >= 1)) {
            mapped.stage = 'Discussion'
        } else {
            mapped.stage = 'Nouveau'
        }

        pipeline[mapped.stage].push(mapped)
    }

    return pipeline
}
