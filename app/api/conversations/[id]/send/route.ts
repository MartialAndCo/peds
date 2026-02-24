import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { discord } from '@/lib/discord'
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
        const { message_text, text, mediaUrl, mediaType, voiceBase64 } = body
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
        const isDiscord = phone.startsWith('DISCORD_') || conversation.contact.source === 'discord' || phone.includes('@discord')

        // Send voice, media, or text via WhatsApp or Discord
        if (voiceBase64) {
            // Voice message (TTS generated)
            if (isDiscord) {
                // Discord doesn't support PTT voice, send as file
                await discord.sendFile(phone, voiceBase64, 'voice.mp3', undefined, agentId)
            } else {
                await whatsapp.sendVoice(phone, voiceBase64, undefined, agentId)
            }
        } else if (mediaUrl) {
            const detectedType = mediaType || detectMediaType(mediaUrl)

            if (isDiscord) {
                // Discord Sending Logic
                if (detectedType === 'image') {
                    await discord.sendImage(phone, mediaUrl, messageText || undefined, agentId)
                } else if (detectedType === 'video') {
                    // Discord treats videos as files usually, or we can use sendFile if sendVideo isn't specific
                    // Using sendFile for video as per typical Discord bot patterns if no specific video endpoint
                    const filename = mediaUrl.split('/').pop() || 'video.mp4'
                    await discord.sendFile(phone, mediaUrl, filename, messageText || undefined, agentId)
                } else {
                    // Generic file
                    const filename = mediaUrl.split('/').pop() || 'file'
                    await discord.sendFile(phone, mediaUrl, filename, messageText || undefined, agentId)
                }
            } else {
                // WhatsApp Sending Logic
                if (detectedType === 'image') {
                    await whatsapp.sendImage(phone, mediaUrl, messageText || undefined, agentId)
                } else if (detectedType === 'video') {
                    await whatsapp.sendVideo(phone, mediaUrl, messageText || undefined, agentId)
                } else {
                    // Generic file
                    const filename = mediaUrl.split('/').pop() || 'file'
                    await whatsapp.sendFile(phone, mediaUrl, filename, messageText || undefined, agentId)
                }
            }

            // Update Media.sentTo if this media exists in our bank
            try {
                // Find media by URL (we use endsWith to match potential query params difference)
                // Note: exact match is safer if URLs are consistent
                const media = await prisma.media.findFirst({
                    where: { url: mediaUrl }
                })

                if (media) {
                    const alreadySent = media.sentTo.includes(phone)
                    if (!alreadySent) {
                        await prisma.media.update({
                            where: { id: media.id },
                            data: {
                                sentTo: { push: phone }
                            }
                        })
                    }
                }
            } catch (err) {
                console.error('[Send] Failed to update media tracking:', err)
                // Don't fail the request, just log it
            }
        } else if (messageText) {
            if (isDiscord) {
                await discord.sendText(phone, messageText, agentId)
            } else {
                await whatsapp.sendText(phone, messageText, undefined, agentId)
            }
        } else {
            return NextResponse.json({ error: 'No message or media provided' }, { status: 400 })
        }

        // Save to DB
        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'admin',
                message_text: voiceBase64 ? `[VOICE] ${messageText}` : (messageText || (mediaUrl ? '[Media]' : '')),
                mediaUrl: mediaUrl || null,
                timestamp: new Date()
            }
        })

        // Cancel any pending queued AI messages since admin just replied manually
        try {
            const deletedQueue = await prisma.messageQueue.deleteMany({
                where: {
                    conversationId: conversation.id,
                    status: 'PENDING'
                }
            })
            if (deletedQueue.count > 0) {
                console.log(`[Send] Cancelled ${deletedQueue.count} pending queue messages for manual reply.`)
            }
        } catch (queueErr) {
            console.error('[Send] Failed to clear pending AI messages:', queueErr)
        }

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
