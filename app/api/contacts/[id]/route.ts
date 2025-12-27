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
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params

        const contact = await prisma.contact.findUnique({
            where: { id },
            include: { conversations: true }
        })

        if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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

        return NextResponse.json(contact)
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    try {
        // Manual cascade delete fallback (Deep Clean)
        // 1. Find conversations
        const conversations = await prisma.conversation.findMany({
            where: { contactId: id },
            select: { id: true }
        })
        const conversationIds = conversations.map(c => c.id)

        // 2. Delete messages in those conversations
        if (conversationIds.length > 0) {
            await prisma.message.deleteMany({
                where: { conversationId: { in: conversationIds } }
            })
        }

        // 3. Delete conversations
        await prisma.conversation.deleteMany({
            where: { contactId: id }
        })

        // 4. Delete Mem0 memories (Using phone_whatsapp as userId)
        const contact = await prisma.contact.findUnique({ where: { id } });
        if (contact && contact.phone_whatsapp) {
            const { memoryService } = require('@/lib/memory');
            // Fire and forget or await? Await to ensure cleanup.
            await memoryService.deleteAll(contact.phone_whatsapp);
        }

        // 5. Delete contact
        await prisma.contact.delete({
            where: { id }
        })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
