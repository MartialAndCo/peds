import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { whatsapp } from '@/lib/whatsapp'

const createConversationSchema = z.object({
    contact_id: z.string(),
    prompt_id: z.number(),
    initial_message: z.string().min(1).optional(),
})

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status')
        const contactId = searchParams.get('contact_id')
        const agentId = searchParams.get('agentId')

        console.log(`[API GET Conversations] AgentId: ${agentId}, Status: ${status}, Contact: ${contactId}`)

        const where: any = {}
        if (status) where.status = status
        if (contactId) where.contactId = contactId

        // Filter by Agent: Include matching Agent ID OR null (legacy/unassigned)
        if (agentId) {
            where.OR = [
                { agentId: agentId },
                { agentId: null }
            ]
        }

        const conversations = await prisma.conversation.findMany({
            where: {
                ...where,
                contact: {
                    source: { notIn: ['system', 'hidden'] }
                }
            },
            include: {
                contact: true,
                prompt: true,
                messages: {
                    orderBy: { timestamp: 'desc' },
                    take: 1
                }
            },
            // Initial sort by creation, but we will re-sort in memory by last message
            orderBy: { createdAt: 'desc' }
        })

        // Sort by Last Message Timestamp
        conversations.sort((a, b) => {
            const dateA = a.messages[0]?.timestamp?.getTime() || a.createdAt.getTime()
            const dateB = b.messages[0]?.timestamp?.getTime() || b.createdAt.getTime()
            return dateB - dateA
        })

        return NextResponse.json(conversations)
    } catch (error) {
        console.error("[API] GET /conversations error:", error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const json = await req.json()
        const body = createConversationSchema.parse(json)

        // Check if contact has active conversation?
        const existing = await prisma.conversation.findFirst({
            where: {
                contactId: body.contact_id,
                status: 'active'
            }
        })

        // Spec doesn't strictly forbid multiple, but practical usage usually limits to 1 active.
        // We'll allow it but maybe warn? For MVP, just create new.

        const conversation = await prisma.conversation.create({
            data: {
                contactId: body.contact_id,
                promptId: body.prompt_id,
                status: 'active',
                ai_enabled: true
            },
            include: { contact: true }
        })

        // If initial message provided, send it
        if (body.initial_message) {
            // Send via WhatsApp
            const phone = conversation.contact.phone_whatsapp
            if (!phone) {
                return NextResponse.json({ error: 'Contact has no WhatsApp phone number' }, { status: 400 })
            }
            await whatsapp.sendText(phone, body.initial_message)

            // Save to DB
            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    sender: 'admin',
                    message_text: body.initial_message,
                    timestamp: new Date()
                }
            })
        }

        return NextResponse.json(conversation, { status: 201 })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
