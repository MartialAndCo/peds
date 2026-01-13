import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { anthropic } from '@/lib/anthropic'
import axios from 'axios'
const { director } = require('@/lib/director')

export const activator = {
    async activateConversation(conversationId: number, context: string, settings: any) {
        console.log(`[Activator] Activating Conversation ${conversationId} with context: "${context}"`)

        // 1. Activate Conversation
        const conversation = await prisma.conversation.update({
            where: { id: conversationId },
            data: { status: 'active' },
            include: { contact: true, prompt: true }
        })

        // 2. Fetch History
        const history = await prisma.message.findMany({
            where: { conversationId: conversationId },
            orderBy: { timestamp: 'asc' },
            take: 20
        })

        const messagesForAI = history.map((m: any) => ({
            role: m.sender === 'contact' ? 'user' : 'ai',
            content: m.message_text
        }))

        // Ensure we have a user message
        if (messagesForAI.length === 0) {
            console.log('[Activator] No messages to reply to.')
            return { success: true, message: 'Activated (Silent)' }
        }

        const lastMessage = messagesForAI[messagesForAI.length - 1].content
        const contextMessages = messagesForAI.slice(0, -1)

        // 3. Build System Prompt
        const { phase, details } = await director.determinePhase(conversation.contact.phone_whatsapp)
        const agentId = conversation.agentId // Get agentId from conversation
        let systemPrompt = await director.buildSystemPrompt(
            settings,
            conversation.contact,
            phase,
            details,
            conversation.prompt.system_prompt,
            agentId // Pass agentId to Director
        )

        // INJECT CONTEXT
        if (context) {
            const defaultActivatorPrompt = `\n\n[IMMEDIATE CONTEXT (HAPPENED 5 MINS AGO)]:\n${context}\n\n[INSTRUCTION]: CONTINUE the flow. This context is FRESH. Do NOT say "I remember you mentioned" (that sounds fake). Just react naturally as if switching apps (Snapchat -> WhatsApp). Be casual and direct.`
            const activatorPromptTemplate = settings.prompt_activator_context || defaultActivatorPrompt;
            systemPrompt += activatorPromptTemplate.replace('{CONTEXT}', context);
        }

        // 4. Generate AI
        const provider = settings.ai_provider || 'venice'
        let aiText = ""

        try {
            if (provider === 'anthropic') {
                aiText = await anthropic.chatCompletion(
                    systemPrompt,
                    contextMessages,
                    lastMessage,
                    { apiKey: settings.anthropic_api_key, model: conversation.prompt.model, temperature: settings.ai_temperature ? Number(settings.ai_temperature) : Number(conversation.prompt.temperature) }
                )
            } else {
                aiText = await venice.chatCompletion(
                    systemPrompt,
                    contextMessages,
                    lastMessage,
                    { apiKey: settings.venice_api_key, model: conversation.prompt.model, temperature: settings.ai_temperature ? Number(settings.ai_temperature) : Number(conversation.prompt.temperature) }
                )
            }
        } catch (e: any) {
            console.error('[Activator] AI Generation Failed:', e)
            return { error: 'AI Generation Failed' }
        }

        // Cleanup
        aiText = aiText.replace(/\*[^*]+\*/g, '').trim()

        // 5. Send to WhatsApp (Baileys Docker)
        const wahaEndpoint = settings.waha_endpoint
        const wahaSession = settings.waha_session || 'default'
        const authToken = settings.waha_api_key // This is now AUTH_TOKEN for Baileys

        const parts = aiText.split('|||').filter(p => p.trim().length > 0)

        // Convert phone number to correct JID format for Baileys
        const rawPhone = conversation.contact.phone_whatsapp.replace(/[^0-9]/g, '')
        const chatJid = `${rawPhone}@s.whatsapp.net`

        for (const part of parts) {
            try {
                await axios.post(`${wahaEndpoint}/api/sendText`, {
                    sessionId: wahaSession, // Baileys expects sessionId, not session
                    chatId: chatJid,
                    text: part.trim()
                }, {
                    headers: { 'x-api-key': authToken } // Correct header for Baileys
                })
            } catch (e: any) {
                console.error('[Activator] WAHA Send Failed:', e.message)
            }
        }

        // 6. Save AI Message
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'ai',
                message_text: aiText,
                timestamp: new Date()
            }
        })

        return { success: true, response: aiText }
    }
}
