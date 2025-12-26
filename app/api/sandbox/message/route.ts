import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { anthropic } from '@/lib/anthropic'
// We don't use 'whatsapp' lib here for sending, but we might need it for helpers?
// Actually we want to return the response to the UI, not send it to WhatsApp.

const SANDBOX_PHONE = 'SANDBOX_CLIENT'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { message } = body // User typed message

        if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

        // 1. Setup Sandbox Contact
        const contact = await prisma.contact.upsert({
            where: { phone_whatsapp: SANDBOX_PHONE },
            update: {},
            create: {
                phone_whatsapp: SANDBOX_PHONE,
                name: "Sandbox User",
                source: "Sandbox",
                status: 'sandbox'
            }
        })

        // 2. Find/Create Conversation
        let conversation = await prisma.conversation.findFirst({
            where: { contactId: contact.id, status: 'active' },
            include: { prompt: true }
        })

        if (!conversation) {
            const defaultPrompt = await prisma.prompt.findFirst({ where: { isActive: true } }) || await prisma.prompt.findFirst()
            if (!defaultPrompt) return NextResponse.json({ error: 'No prompt configured' }, { status: 500 })

            conversation = await prisma.conversation.create({
                data: {
                    contactId: contact.id,
                    promptId: defaultPrompt.id,
                    status: 'active',
                    ai_enabled: true
                },
                include: { prompt: true }
            })
        }

        // 3. Save User Message
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'contact',
                message_text: message,
                timestamp: new Date()
            }
        })

        // 4. Analysis & Logic (Mirrors Webhook)
        const { mediaService } = require('@/lib/media')

        // Settings
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        // Detect Intent
        const analysis = await mediaService.analyzeRequest(message)
        let responsePayload: any = { type: 'text', content: '' }

        if (analysis && analysis.isMediaRequest) {
            if (!analysis.allowed) {
                responsePayload = { type: 'text', content: analysis.refusalReason || "Je ne peux pas envoyer ce type de contenu." }
            } else if (analysis.intentCategory) {
                const result = await mediaService.processRequest(contact.phone_whatsapp, analysis.intentCategory)

                if (result.action === 'SEND') {
                    // Send Media
                    // Mark sent
                    await prisma.media.update({
                        where: { id: result.media.id },
                        data: { sentTo: { push: contact.phone_whatsapp } }
                    })

                    // Save System Message
                    const { memoryService } = require('@/lib/memory')
                    await memoryService.add(contact.phone_whatsapp, message)
                    await memoryService.add(contact.phone_whatsapp, `[System]: Sent media ${analysis.intentCategory}`)

                    await prisma.message.create({
                        data: {
                            conversationId: conversation.id,
                            sender: 'ai',
                            message_text: `[Sent Media: ${analysis.intentCategory}]`,
                            timestamp: new Date()
                        }
                    })

                    responsePayload = {
                        type: 'media',
                        url: result.media.url,
                        category: analysis.intentCategory
                    }
                    return NextResponse.json(responsePayload)

                } else if (result.action === 'REQUEST_SOURCE') {
                    // Request Pending logic
                    const status = await mediaService.requestFromSource(contact.phone_whatsapp, analysis.intentCategory)

                    // Generate "Wait" message
                    const instruction = status === 'REQUEST_NEW'
                        ? `(SYSTEM: User wants ${analysis.intentCategory}. You don't have it. Tell them you'll check later.)`
                        : `(SYSTEM: User asking AGAIN for ${analysis.intentCategory}. Tell them to be patient.)`

                    const provider = settings.ai_provider || 'venice'
                    const userMessageForAI = message + "\n\n" + instruction
                    let aiText = ""

                    if (provider === 'anthropic') {
                        aiText = await anthropic.chatCompletion(
                            conversation.prompt.system_prompt || "You are a helpful assistant.",
                            [],
                            userMessageForAI,
                            { apiKey: settings.anthropic_api_key, model: settings.anthropic_model || 'claude-3-haiku-20240307' }
                        )
                    } else {
                        aiText = await venice.chatCompletion(
                            conversation.prompt.system_prompt || "You are a helpful assistant.",
                            [],
                            userMessageForAI,
                            { apiKey: settings.venice_api_key, model: settings.venice_model || 'venice-uncensored' }
                        )
                    }
                    responsePayload = { type: 'text', content: aiText, meta: '[System] Requested from Source' }
                }
            }
        }

        // Standard AI Chat if no response yet
        if (!responsePayload.content && responsePayload.type === 'text') {
            // Fetch History
            const history = await prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { timestamp: 'asc' },
                take: 20
            })

            // Clean & Dedup (Same as Webhook)
            const cleanHistory = history.filter((m: any) => !m.message_text.includes('[Voice Message -'))
            const uniqueHistory: any[] = []
            cleanHistory.forEach((m: any) => {
                const prev = uniqueHistory[uniqueHistory.length - 1]
                if (prev && prev.sender === m.sender && prev.message_text === m.message_text) return
                uniqueHistory.push(m)
            })

            const messagesForAI = uniqueHistory.map((m: any) => ({
                role: m.sender === 'contact' ? 'user' : 'ai',
                content: m.message_text
            }))

            // Allow last message to be part of history for context?
            // Actually in webhook we slice(0, -1) and pass last separately.
            const contextMessages = messagesForAI.slice(0, -1)
            const lastMessage = messagesForAI[messagesForAI.length - 1].content

            // Mem0
            const { memoryService } = require('@/lib/memory')
            let fetchedMemories: any[] = []
            try {
                const searchResults = await memoryService.search(contact.phone_whatsapp, lastMessage)
                fetchedMemories = Array.isArray(searchResults) ? searchResults : (searchResults?.results || [])
            } catch (e) {
                console.error('Mem0 error', e)
            }

            // --- STATE-AWARE AGENT LOGIC (Sandbox Version) ---
            const { director } = require('@/lib/director')

            // 1. Update Trust (Fire & Forget)
            director.updateTrustScore(contact.phone_whatsapp, lastMessage).catch((e: any) => console.error("Trust Update Failed:", e))

            // 2. Get Phase & Context
            const { phase, details } = await director.determinePhase(contact.phone_whatsapp)

            // 3. Construct Modular Prompt
            // We use the same 'buildSystemPrompt' as the webhook
            let systemPrompt = director.buildSystemPrompt(
                settings,
                contact,
                phase,
                details,
                conversation.prompt.system_prompt // base role
            )

            // Mem0 Context Injection
            if (fetchedMemories.length > 0) {
                const memoriesText = fetchedMemories.map((m: any) => `- ${m.memory}`).join('\n')
                systemPrompt += `\n\n[USER MEMORY / CONTEXT]:\n${memoriesText}\n\n[INSTRUCTION]: Use the above memory to personalize the response.`
            }

            // Generate using dynamically built prompt
            const provider = settings.ai_provider || 'venice'
            let aiText = ""

            console.log('[Sandbox] Using Phase:', phase)

            if (provider === 'anthropic') {
                aiText = await anthropic.chatCompletion(
                    systemPrompt,
                    contextMessages,
                    lastMessage,
                    { apiKey: settings.anthropic_api_key, model: conversation.prompt.model || 'claude-3-haiku-20240307', temperature: Number(conversation.prompt.temperature) }
                )
            } else {
                aiText = await venice.chatCompletion(
                    systemPrompt,
                    contextMessages,
                    lastMessage,
                    { apiKey: settings.venice_api_key, model: conversation.prompt.model || 'venice-uncensored', temperature: Number(conversation.prompt.temperature) }
                )
            }

            // --- GUARDRAIL: STRIP ASTERISKS ---
            aiText = aiText.replace(/\*[^*]+\*/g, '').trim()

            // Store Memory
            try {
                await memoryService.add(contact.phone_whatsapp, lastMessage)
                await memoryService.add(contact.phone_whatsapp, aiText)
            } catch (e) { }

            responsePayload = { type: 'text', content: aiText }
        }

        // Save AI Response
        if (responsePayload.content) {
            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    sender: 'ai',
                    message_text: responsePayload.content,
                    timestamp: new Date()
                }
            })
        }

        return NextResponse.json(responsePayload)

    } catch (error: any) {
        console.error('Sandbox Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
