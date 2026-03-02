import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
    agentId: z.string(),
    phase: z.enum(['CONNECTION', 'VULNERABILITY', 'CRISIS', 'MONEYPOT', 'WAR_1', 'WAR_2', 'WAR_3']),
    warModeLinks: z.array(z.string()).optional(),
    warModeMedia: z.array(z.string()).optional()
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const contactId = id
    if (!contactId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    try {
        const json = await req.json()
        const { agentId, phase, warModeLinks, warModeMedia } = schema.parse(json)

        // Find AgentContact
        const ac = await prisma.agentContact.findFirst({
            where: { contactId, agentId }
        })

        if (!ac) {
            return NextResponse.json({ error: 'AgentContact not found' }, { status: 404 })
        }

        // Update Agent Phase
        const updated = await prisma.agentContact.update({
            where: { id: ac.id },
            data: { phase }
        })

        // Also update the latest conversation's metadata to store the links/media for Swarm injection
        if (warModeLinks?.length || warModeMedia?.length) {
            const latestConv = await prisma.conversation.findFirst({
                where: { contactId, agentId },
                orderBy: { createdAt: 'desc' }
            })

            if (latestConv) {
                let metadata: any = latestConv.metadata ? (typeof latestConv.metadata === 'string' ? JSON.parse(latestConv.metadata) : latestConv.metadata) : {}
                metadata = {
                    ...metadata,
                    warModeLinks: warModeLinks ?? undefined,
                    warModeMedia: warModeMedia ?? undefined
                }

                await prisma.conversation.update({
                    where: { id: latestConv.id },
                    data: { metadata }
                })
            }
        }

        return NextResponse.json(updated)
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
