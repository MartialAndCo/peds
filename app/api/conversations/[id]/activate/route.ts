import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { anthropic } from '@/lib/anthropic'
import axios from 'axios'
const { director } = require('@/lib/director')


export const dynamic = 'force-dynamic'; // Prevent caching

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const conversationId = parseInt(id)
        const { context, ai_provider } = await req.json()

        console.log(`[Activate] Request for Conversation ID: ${conversationId}`)

        // 1. Activate Conversation & Update Notes

        const conversation = await prisma.conversation.update({
            where: { id: conversationId },
            data: { status: 'active' },
            include: { contact: true, prompt: true }
        })

        if (context) {
            await prisma.contact.update({
                where: { id: conversation.contactId },
                data: { notes: context }
            })
        }

        // 2. Fetch History to generate First Reply
        const history = await prisma.message.findMany({
            where: { conversationId: conversationId },
            orderBy: { timestamp: 'asc' },
            take: 20
        })

        const messagesForAI = history.map((m: any) => ({
            role: m.sender === 'contact' ? 'user' : 'ai',
            content: m.message_text
        }))

        // Ensure we have a user message to reply to
        if (messagesForAI.length === 0) {
            return NextResponse.json({ message: 'Activated, but no messages to reply to.' })
        }

        const lastMessage = messagesForAI[messagesForAI.length - 1].content
        const contextMessages = messagesForAI.slice(0, -1)

        // 3. Get Settings
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        // 4. Build System Prompt (with Context Injection)
        const { phase, details } = await director.determinePhase(conversation.contact.phone_whatsapp)
        let systemPrompt = director.buildSystemPrompt(
            settings,
            conversation.contact,
            phase,
            details,
            conversation.prompt.system_prompt
        )

        // INJECT ADMIN CONTEXT EXPLICITLY
        if (context) {
            systemPrompt += `\n\n[IMMEDIATE CONTEXT (HAPPENED 5 MINS AGO)]:\n${context}\n\n[INSTRUCTION]: CONTINUE the flow. This context is FRESH. Do NOT say "I remember you mentioned" (that sounds fake). Just react naturally as if switching apps (Snapchat -> WhatsApp). Be casual and direct.`
        }

        // 5. Generate AI Response
        const provider = settings.ai_provider || 'venice'
        let aiText = ""

        if (provider === 'anthropic') {
            aiText = await anthropic.chatCompletion(
                systemPrompt,
                contextMessages,
                lastMessage,
                { apiKey: settings.anthropic_api_key, model: conversation.prompt.model, temperature: Number(conversation.prompt.temperature) }
            )
        } else {
            aiText = await venice.chatCompletion(
                systemPrompt,
                contextMessages,
                lastMessage,
                { apiKey: settings.venice_api_key, model: conversation.prompt.model, temperature: Number(conversation.prompt.temperature) }
            )
        }

        // Guardrail: Strip Asterisks
        aiText = aiText.replace(/\*[^*]+\*/g, '').trim()

        // 6. Send to WhatsApp
        const wahaEndpoint = settings.waha_endpoint
        const wahaSession = settings.waha_session || 'default'
        const wahaKey = settings.waha_api_key

        // Splitting Logic
        const parts = aiText.split('|||').filter(p => p.trim().length > 0)

        for (const part of parts) {
            await axios.post(`${wahaEndpoint}/api/sendText`, {
                session: wahaSession,
                chatId: `${conversation.contact.phone_whatsapp}@c.us`,
                text: part.trim(),
                reply_to: null
            }, {
                headers: { 'X-Api-Key': wahaKey }
            })
            // Simulating typing delay would be nice but simple loop is fine for v1
        }

        // 7. Save AI Message
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'ai',
                message_text: aiText,
                timestamp: new Date()
            }
        })

        return NextResponse.json({ success: true, response: aiText })

    } catch (e: any) {
        console.error('Activation Error', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
