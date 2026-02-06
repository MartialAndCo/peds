import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const contactSchema = z.object({
    name: z.string().min(1).optional(),
    phone_whatsapp: z.string().min(8).regex(/^\+?[0-9\s]+$/, 'Invalid phone number').optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
    status: z.string().optional(),
    testMode: z.boolean().optional(),
    isHidden: z.boolean().optional()
})

export const dynamic = 'force-dynamic'; // Ensure we always fetch fresh DB state

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params
        const { searchParams } = new URL(req.url)
        const agentId = searchParams.get('agentId')

        const contact: any = await prisma.contact.findUnique({
            where: { id },
            include: {
                conversations: {
                    orderBy: { createdAt: 'desc' },
                },
                trustLogs: {
                    orderBy: { createdAt: 'desc' }
                },
                payments: {
                    orderBy: { createdAt: 'desc' }
                },
                agentContacts: agentId ? {
                    where: { agentId: agentId }
                } : false
            }
        })

        if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        // 🧠 SMART OVERRIDE: If Agent Context is requested, show Agent-Specific Phase/Score
        if (agentId && contact.agentContacts && contact.agentContacts.length > 0) {
            const ac = contact.agentContacts[0]
            console.log(`[API] Contact Context Override for Agent ${agentId}: Phase ${contact.agentPhase} -> ${ac.phase}`)

            contact.agentPhase = ac.phase
            contact.trustScore = ac.trustScore // or use signals if UI supports it

            // Inject agentContact info for robust UIs
            contact._agentContext = ac
        }

        return NextResponse.json(contact)
    } catch (error) {
        console.error("[API] GET /contacts/[id] error:", error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    try {
        const json = await req.json()
        const body = contactSchema.parse(json)

        // AUTO-UNPAUSE LOGIC
        // If notes are updated (added/changed) and status isn't explicitly set, 
        // automatically set status to 'active' so the agent handles the context immediately.
        if (body.notes && body.notes.trim().length > 0 && !body.status) {
            body.status = 'active';
        }

        const contact = await prisma.contact.update({
            where: { id },
            data: body
        })

        // SYNC CONVERSATION STATUS & TRIGGER AI
        // If contact is made active, ensure the latest conversation is also active (unpaused) AND reply.
        if (body.status === 'active') {
            const latestConv = await prisma.conversation.findFirst({
                where: { contactId: id },
                orderBy: { createdAt: 'desc' }
            })

            if (latestConv && latestConv.status === 'paused') {
                console.log(`[PUT Contact] Contact activated. Triggering AI Activation for Conv ${latestConv.id}`)

                // Fetch Settings
                const settingsList = await prisma.setting.findMany()
                const settings = settingsList.reduce((acc: any, curr: any) => {
                    acc[curr.key] = curr.value
                    return acc
                }, {})

                const { activator } = require('@/lib/activator')
                // Run in background (don't block UI)
                activator.activateConversation(latestConv.id, body.notes || "", settings)
                    .then((res: any) => console.log('[PUT Contact] Auto-Activation Result:', res))
                    .catch((err: any) => console.error('[PUT Contact] Auto-Activation Failed:', err))
            }
        }

        return NextResponse.json(contact)
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    return PUT(req, { params })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    try {
        const { deleteContactCompletely } = await import('@/lib/contact-utils')
        await deleteContactCompletely(id)
        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (error.message === 'Contact not found' || error.code === 'P2025') {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        console.error("Delete Error", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
