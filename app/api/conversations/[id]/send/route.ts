import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { message_text, text, mediaUrl, mediaType } = body
        const messageText = message_text || text || '' // Support both formats
        const { id: idStr } = await params
        const conversation = await prisma.conversation.findUnique({
            where: { id: parseInt(idStr) },
            include: { contact: true }
        })

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        const phone = conversation.contact.phone_whatsapp
        if (!phone) {
            return NextResponse.json({ error: 'Contact has no WhatsApp phone number' }, { status: 400 })
        }

        const agentId = conversation.agentId || undefined

        // Send media or text via WhatsApp
        if (mediaUrl) {
            const detectedType = mediaType || detectMediaType(mediaUrl)

            if (detectedType === 'image') {
                await whatsapp.sendImage(phone, mediaUrl, messageText || undefined, agentId)
            } else if (detectedType === 'video') {
                await whatsapp.sendVideo(phone, mediaUrl, messageText || undefined, agentId)
            } else {
                // Generic file
                const filename = mediaUrl.split('/').pop() || 'file'
                await whatsapp.sendFile(phone, mediaUrl, filename, messageText || undefined, agentId)
            }
        } else if (messageText) {
            await whatsapp.sendText(phone, messageText, undefined, agentId)
        } else {
            return NextResponse.json({ error: 'No message or media provided' }, { status: 400 })
        }

        // Save to DB
        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'admin',
                message_text: messageText || (mediaUrl ? '[Media]' : ''),
                mediaUrl: mediaUrl || null,
                timestamp: new Date()
            }
        })

        // Update conversation last activity
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt: new Date(),
                lastMessageSender: 'admin'
            }
        })

        return NextResponse.json({ success: true, message })

    } catch (error: any) {
        console.error('[Send] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

function detectMediaType(url: string): 'image' | 'video' | 'audio' | 'file' {
    const lower = url.toLowerCase()
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|#|$)/.test(lower)) return 'image'
    if (/\.(mp4|mov|avi|webm|mkv)(\?|#|$)/.test(lower)) return 'video'
    if (/\.(mp3|wav|ogg|m4a|opus|aac)(\?|#|$)/.test(lower)) return 'audio'
    // Check MIME-like patterns in Supabase URLs
    if (lower.includes('image') || lower.includes('chat-images')) return 'image'
    if (lower.includes('video') || lower.includes('chat-videos')) return 'video'
    return 'file'
}
