import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'


export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { message_text, text } = await req.json()
        const messageText = message_text || text // Support both formats
        const { id: idStr } = await params
        const conversation = await prisma.conversation.findUnique({
            where: { id: parseInt(idStr) },
            include: { contact: true }
        })

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        // Send via WhatsApp with specific Agent Session
        // We cast to string | undefined just in case, though agentId is String? in schema
        const phone = conversation.contact.phone_whatsapp
        if (!phone) {
            return NextResponse.json({ error: 'Contact has no WhatsApp phone number' }, { status: 400 })
        }
        await whatsapp.sendText(phone, messageText, undefined, conversation.agentId || undefined)

        // Save to DB
        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'admin',
                message_text: messageText,
                timestamp: new Date()
            }
        })
        
        // Update conversation last activity (Admin message)
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt: new Date(),
                lastMessageSender: 'admin'
            }
        })

        return NextResponse.json({ success: true, message })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
