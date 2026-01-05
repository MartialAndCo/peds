import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { venice } from '@/lib/venice'
import { openrouter } from '@/lib/openrouter'
import { anthropic } from '@/lib/anthropic'

/**
 * Recovery Cron - Detects and retries "stuck" conversations
 * A conversation is stuck if:
 * - Last message is from contact (not AI)
 * - Last message is older than 5 minutes
 * - Conversation is active (not paused)
 * - No PENDING item in MessageQueue for this conversation
 * 
 * Runs every 30 minutes via Baileys pinger
 */
export async function GET(req: Request) {
    try {
        const now = new Date()
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

        console.log(`[Recovery] Starting recovery check at ${now.toISOString()}`)

        // Find active conversations with recent contact messages
        const activeConversations = await prisma.conversation.findMany({
            where: {
                status: 'active'
            },
            include: {
                contact: true,
                prompt: true,
                messages: {
                    orderBy: { timestamp: 'desc' },
                    take: 1
                }
            }
        })

        let recovered = 0
        let skipped = 0

        for (const conv of activeConversations) {
            // Skip if no messages
            if (conv.messages.length === 0) {
                skipped++
                continue
            }

            const lastMessage = conv.messages[0]

            // Skip if last message is from AI (already responded)
            if (lastMessage.sender !== 'contact') {
                skipped++
                continue
            }

            // Skip if last message is too recent (less than 5 min old)
            if (lastMessage.timestamp > fiveMinutesAgo) {
                skipped++
                continue
            }

            // Check if there's already a pending queue item
            const pendingQueue = await prisma.messageQueue.findFirst({
                where: {
                    conversationId: conv.id,
                    status: 'PENDING'
                }
            })

            if (pendingQueue) {
                skipped++
                continue
            }

            // This conversation is STUCK - no AI response was ever created
            console.log(`[Recovery] Found stuck conversation ${conv.id} (Contact: ${conv.contact.name || conv.contact.phone_whatsapp})`)
            console.log(`[Recovery] Last message from contact at ${lastMessage.timestamp.toISOString()}: "${lastMessage.message_text.substring(0, 50)}..."`)

            try {
                // Attempt recovery
                await recoverConversation(conv, lastMessage.message_text)
                recovered++
                console.log(`[Recovery] Successfully recovered conversation ${conv.id}`)
            } catch (e: any) {
                console.error(`[Recovery] Failed to recover conversation ${conv.id}:`, e.message)
            }
        }

        console.log(`[Recovery] Complete. Recovered: ${recovered}, Skipped: ${skipped}`)
        return NextResponse.json({ success: true, recovered, skipped, total: activeConversations.length })

    } catch (error: any) {
        console.error('[Recovery] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

async function recoverConversation(conv: any, lastContactMessage: string) {
    const contact = conv.contact
    const prompt = conv.prompt

    if (!prompt) {
        throw new Error('No prompt associated with conversation')
    }

    // Fetch settings
    const settings = await prisma.setting.findMany()
    const settingsMap = settings.reduce((acc: any, s) => { acc[s.key] = s.value; return acc }, {})

    // Build context
    const history = await prisma.message.findMany({
        where: { conversationId: conv.id },
        orderBy: { timestamp: 'desc' },
        take: 30
    })

    const contextMessages = history.reverse().map((m: any) => ({
        role: m.sender === 'contact' ? 'user' : 'ai',
        content: m.message_text
    }))

    // Build system prompt
    const systemPrompt = `${prompt.content}\n\nContact Name: ${contact.name || 'Unknown'}`

    // Call AI
    const provider = settingsMap.ai_provider || 'venice'
    const params = {
        apiKey: provider === 'anthropic' ? settingsMap.anthropic_api_key :
            (provider === 'openrouter' ? settingsMap.openrouter_api_key : settingsMap.venice_api_key),
        model: provider === 'anthropic' ? settingsMap.anthropic_model :
            (provider === 'openrouter' ? settingsMap.openrouter_model : prompt.model),
        temperature: Number(prompt.temperature || 0.7),
        max_tokens: prompt.max_tokens || 500
    }

    console.log(`[Recovery] Conv ${conv.id} - Calling ${provider}...`)

    let responseText = ""
    if (provider === 'anthropic') {
        responseText = await anthropic.chatCompletion(systemPrompt, contextMessages, lastContactMessage, params)
    } else if (provider === 'openrouter') {
        responseText = await openrouter.chatCompletion(systemPrompt, contextMessages, lastContactMessage, params)
    } else {
        responseText = await venice.chatCompletion(systemPrompt, contextMessages, lastContactMessage, params)
    }

    // Clean response
    responseText = responseText.replace(new RegExp('\\*[^*]+\\*', 'g'), '').trim()

    if (!responseText || responseText.length === 0) {
        throw new Error('AI returned empty response again')
    }

    console.log(`[Recovery] Conv ${conv.id} - AI Response: "${responseText.substring(0, 50)}..."`)

    // Save to Message table
    await prisma.message.create({
        data: {
            conversationId: conv.id,
            sender: 'ai',
            message_text: responseText.replace(/\|\|\|/g, '\n'),
            timestamp: new Date()
        }
    })

    // Queue for sending (use scheduledAt: now for immediate send)
    await prisma.messageQueue.create({
        data: {
            contactId: contact.id,
            conversationId: conv.id,
            content: responseText,
            scheduledAt: new Date(),
            status: 'PENDING'
        }
    })

    // Note: The process-queue cron will pick this up and send it
}
