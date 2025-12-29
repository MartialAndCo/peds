import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { venice } from '@/lib/venice'

export async function GET(req: Request) {
    try {
        console.log('[RescueCron] Checking for abandoned conversations...')

        // 1. Find conversations that might be stuck
        // Criteria:
        // - Status is ACTIVE
        // - Last message is from CONTACT
        // - Last message is older than 5 minutes
        // - Last message is younger than 24 hours (don't wake up ancient ghosts)
        // - No Processing Lock (or lock is ancient)
        // - No Pending Queue items

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

        // Fetch active conversations
        const candidates = await prisma.conversation.findMany({
            where: {
                status: 'active',
                ai_enabled: true,
                // processingLock: null // We check lock manually to allow breaking stale locks
            },
            include: {
                contact: true,
                prompt: true,
                messages: {
                    orderBy: { timestamp: 'desc' },
                    take: 1
                },
                messageQueue: {
                    where: { status: 'PENDING' }
                }
            }
        })

        const recoveredIds = []

        for (const conv of candidates) {
            // Check Lock
            if (conv.processingLock) {
                const lockTime = new Date(conv.processingLock).getTime()
                const now = new Date().getTime()
                if (now - lockTime < 5 * 60 * 1000) {
                    // Lock is fresh (< 5 mins), skip (process is running or just stuck briefly)
                    continue
                }
                // Lock is stale (> 5 mins), treat as stuck
                console.log(`[Rescue] Conversation ${conv.id} has stale lock. Breaking.`)
            }

            // Check Queue
            if (conv.messageQueue.length > 0) {
                // Has pending scheduled message, so it's not abandoned, just waiting.
                continue
            }

            // Check Last Message
            const lastMsg = conv.messages[0]
            if (!lastMsg) continue // No messages at all

            if (lastMsg.sender !== 'contact') continue // Last was AI, so we are waiting for user. safe.

            const msgTime = new Date(lastMsg.timestamp)
            if (msgTime > fiveMinutesAgo) continue // Too fresh (< 5 mins)
            if (msgTime < twentyFourHoursAgo) continue // Too old (> 24h)

            // FOUND ONE!
            console.log(`[Rescue] Recovering Conversation ${conv.id} (Last User Msg: ${lastMsg.message_text.substring(0, 20)}...)`)

            // ACTION: Generate Reply
            await prisma.conversation.update({
                where: { id: conv.id },
                data: { processingLock: new Date() } // Lock it
            })

            try {
                // Fetch History for Context
                const historyRaw = await prisma.message.findMany({
                    where: { conversationId: conv.id },
                    orderBy: { timestamp: 'desc' },
                    take: 20
                })
                const history = historyRaw.reverse().map(m => ({
                    role: m.sender === 'contact' ? 'user' : 'ai',
                    content: m.message_text
                }))

                const settingsList = await prisma.setting.findMany()
                const settings = settingsList.reduce((acc: any, curr: any) => { acc[curr.key] = curr.value; return acc }, {})

                const systemPrompt = conv.prompt.system_prompt
                const lastUserText = lastMsg.message_text

                // Add a "Recovery" note to system prompt so AI knows context?
                // "SYSTEM: You missed the last message due to a technical glitch. Apologize casually or just reply dynamically."
                // Actually, staying in character is better. Just reply.

                const responseText = await venice.chatCompletion(
                    systemPrompt,
                    history.slice(0, -1), // Context
                    lastUserText, // Trigger
                    { apiKey: settings.venice_api_key, model: conv.prompt.model || 'venice-uncensored' }
                )

                const cleanResponse = responseText.replace(new RegExp('\\*[^*]+\\*', 'g'), '').trim()

                // Send
                await whatsapp.sendText(conv.contact.phone_whatsapp, cleanResponse)

                // Save
                await prisma.message.create({
                    data: {
                        conversationId: conv.id,
                        sender: 'ai',
                        message_text: cleanResponse,
                        timestamp: new Date()
                    }
                })

                recoveredIds.push(conv.id)

            } catch (e) {
                console.error(`[Rescue] Failed to recover ${conv.id}`, e)
            } finally {
                // Unlock
                await prisma.conversation.update({
                    where: { id: conv.id },
                    data: { processingLock: null }
                })
            }
        }

        return NextResponse.json({ success: true, recovered: recoveredIds.length, ids: recoveredIds })

    } catch (error: any) {
        console.error('[RescueCron] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
