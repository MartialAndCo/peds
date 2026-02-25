import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { discord } from '@/lib/discord'
import { runSwarm } from '@/lib/swarm'
import { enforceLength } from '@/lib/services/response-length-guard'

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    return String(error)
}

export async function GET() {
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
                    take: 100 // Updated to 100 as per user request (Large Context Window)
                })
                const history = historyRaw.reverse().map(m => ({
                    role: m.sender === 'contact' ? 'user' : 'ai',
                    content: m.message_text
                }))

                const settingsList = await prisma.setting.findMany()
                const settings = settingsList.reduce<Record<string, string>>((acc, curr) => {
                    if (typeof curr.value === 'string') acc[curr.key] = curr.value
                    return acc
                }, {})

                if (!conv.agentId) {
                    console.warn(`[Rescue] Skipping conversation ${conv.id} - missing agentId`)
                    continue
                }

                const lastUserText = lastMsg.message_text
                const platform = (conv.contact.phone_whatsapp || '').startsWith('DISCORD_') ? 'discord' : 'whatsapp'

                // Use the same Swarm pipeline as standard chat flow to avoid legacy-generic replies.
                const responseText = await runSwarm(
                    lastUserText,
                    history.slice(0, -1),
                    conv.contactId,
                    conv.agentId,
                    conv.contact.name || 'friend',
                    {
                        lastMessageType: 'text',
                        platform
                    }
                )

                const cleanResponse = responseText.replace(new RegExp('\\*[^*]+\\*', 'g'), '').trim()
                const contactProfile =
                    conv.contact?.profile && typeof conv.contact.profile === 'object' && !Array.isArray(conv.contact.profile)
                        ? (conv.contact.profile as Record<string, unknown>)
                        : null
                const contactLocale = typeof contactProfile?.locale === 'string'
                    ? contactProfile.locale
                    : undefined
                const guarded = await enforceLength({
                    text: cleanResponse,
                    locale: contactLocale,
                    apiKey: settings?.venice_api_key || null,
                    source: 'cron.rescue',
                    maxWordsPerBubble: 12,
                    maxBubbles: 2,
                    attempt: 1
                })

                if (guarded.status === 'blocked') {
                    console.warn(`[Rescue] Length guard blocked conversation ${conv.id}`, {
                        reason: guarded.reason,
                        ...guarded.metrics
                    })
                    continue
                }

                // Send
                const phone = conv.contact.phone_whatsapp
                if (!phone) {
                    console.log(`[Rescue] Skipping conversation ${conv.id} - no phone number`)
                    continue
                }

                if (platform === 'discord') {
                    const sent = await discord.sendText(phone, guarded.text, conv.agentId || undefined)
                    if (!sent) {
                        console.warn(`[Rescue] Discord send failed for conversation ${conv.id}`)
                        continue
                    }
                } else {
                    await whatsapp.sendText(phone, guarded.text, undefined, conv.agentId || undefined)
                }

                // Save
                await prisma.message.create({
                    data: {
                        conversationId: conv.id,
                        sender: 'ai',
                        message_text: guarded.text,
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

    } catch (error: unknown) {
        console.error('[RescueCron] Error:', error)
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
    }
}
