/**
 * POST /api/contacts/[id]/intelligence/extract
 * Déclenche une extraction manuelle du profil intelligent
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractContactProfile } from '@/lib/profile-intelligence'

export const dynamic = 'force-dynamic'

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const body = await req.json().catch(() => ({}))
        const agentId = body?.agentId
        const parsedMessageCount = Number(body?.messageCount)
        const messageCount = Number.isFinite(parsedMessageCount)
            ? Math.max(1, Math.min(200, Math.floor(parsedMessageCount)))
            : 50

        // Vérifier que le contact existe
        const contact = await prisma.contact.findUnique({
            where: { id },
            select: { id: true, name: true, phone_whatsapp: true }
        })

        if (!contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
        }

        // Si pas d'agentId fourni, chercher la conversation la plus récente
        let targetAgentId = agentId
        if (!targetAgentId) {
            const conversation = await prisma.conversation.findFirst({
                where: { contactId: id },
                orderBy: { lastMessageAt: 'desc' }
            })
            if (conversation?.agentId) {
                targetAgentId = conversation.agentId
            }
        }

        if (!targetAgentId) {
            return NextResponse.json(
                { error: 'No agent found for this contact' },
                { status: 400 }
            )
        }

        console.log(`[API] Intelligence extraction for contact ${contact.name || id}`)

        // Lancer l'extraction
        const result = await extractContactProfile(id, targetAgentId, {
            messageCount,
            triggeredBy: 'manual'
        })

        if (!result.success) {
            const businessErrors = new Set([
                'No conversation found',
                'No messages to analyze',
                'No agent found for this contact'
            ])
            const status = businessErrors.has(result.error || '')
                ? 422
                : 500

            return NextResponse.json(
                { error: result.error || 'Extraction failed' },
                { status }
            )
        }

        // Récupérer le profil mis à jour
        const profile = await prisma.contactProfile.findUnique({
            where: { contactId: id },
            include: {
                attributes: {
                    where: { isDeleted: false },
                    orderBy: { confidence: 'desc' },
                    take: 20
                },
                relationships: { take: 10 },
                events: { orderBy: { importance: 'desc' }, take: 10 },
                interests: { take: 10 },
                psychology: true,
                financial: true,
                _count: {
                    select: {
                        attributes: true,
                        relationships: true,
                        events: true,
                        interests: true
                    }
                }
            }
        })

        return NextResponse.json({
            success: true,
            contact: {
                id: contact.id,
                name: contact.name,
                phone: contact.phone_whatsapp
            },
            profile,
            confidence: result.confidence
        })

    } catch (error: any) {
        console.error('[API] Intelligence extraction failed:', error)
        return NextResponse.json(
            { error: 'Internal error', message: error.message },
            { status: 500 }
        )
    }
}
