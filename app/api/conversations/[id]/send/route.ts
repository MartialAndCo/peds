import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { waha } from '@/lib/waha'

const sendMessageSchema = z.object({
    message_text: z.string().min(1),
    sender: z.enum(['admin', 'ai']).default('admin'),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    try {
        const json = await req.json()
        const body = sendMessageSchema.parse(json)

        const conversation = await prisma.conversation.findUnique({
            where: { id },
            include: { contact: true }
        })

        if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

        // Send via WAHA
        await waha.sendText(conversation.contact.phone_whatsapp, body.message_text)

        // Save to DB
        const message = await prisma.message.create({
            data: {
                conversationId: id,
                sender: body.sender,
                message_text: body.message_text,
                timestamp: new Date()
            }
        })

        return NextResponse.json(message, { status: 201 })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
