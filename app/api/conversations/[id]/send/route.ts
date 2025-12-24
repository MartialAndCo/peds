import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { waha } from '@/lib/waha'

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { text } = await req.json()
        const { id: idStr } = await params
        const conversation = await prisma.conversation.findUnique({
            where: { id: parseInt(idStr) },
            include: { contact: true }
        })

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        // Send via WhatsApp
        await whatsapp.sendText(conversation.contact.phone_whatsapp, text)

        // Save to DB
        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'admin',
                message_text: text,
                timestamp: new Date()
            }
        })

        return NextResponse.json({ success: true, message })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
