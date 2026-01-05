import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { anthropic } from '@/lib/anthropic'
import { whatsapp } from '@/lib/whatsapp'
import { NextResponse } from 'next/server'

/**
 * Core processor for WhatsApp Webhook Payloads.
 * This function encapsulates the business logic previously in the route handler.
 */
export async function processWhatsAppPayload(payload: any, agentId: number) {
    console.log(`[Processor] Start handling for Agent ${agentId}`)

    try {
        // Ignore own messages
        if (payload.fromMe) return { status: 'ignored_from_me' }

        let from = payload.from // e.g. 33612345678@c.us or @s.whatsapp.net

        // Normalize if coming from raw Baileys
        if (from.includes('@s.whatsapp.net')) {
            from = from.replace('@s.whatsapp.net', '@c.us')
        }

        if (from.includes('@lid')) {
            // LID Handling
        } else if (!from.includes('@c.us')) {
            console.log(`[Processor] Ignored JID: ${from}`)
            return { status: 'ignored_group' }
        }

        // Standardize phone number or LID
        let normalizedPhone = `+${from.split('@')[0]}`

        if (from.includes('@lid')) {
            normalizedPhone = from
            if (payload._data?.phoneNumber) {
                console.log(`[Processor] Replacing LID ${from} with Resolved PN ${payload._data.phoneNumber}`)
                const pn = payload._data.phoneNumber.replace('@s.whatsapp.net', '@c.us', '').replace('@c.us', '')
                normalizedPhone = pn.startsWith('+') ? pn : `+${pn}`
            } else {
                console.warn(`[Processor] SAFETY ALERT: Could not resolve LID to PN for ${from}. IGNORING.`)
                return { status: 'ignored_lid_safety' }
            }
        }

        // Fetch Settings Early
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        // Fetch Agent-Specific Settings (Overrides Global)
        const agentWithSettings = await prisma.agent.findUnique({
            where: { id: Number(agentId) },
            include: { settings: true }
        })

        agentWithSettings?.settings.forEach((s: any) => {
            settings[s.key] = s.value
        })

        // Detect Intent (Smart Logic)
        let messageText = payload.body || ""

        // --- 1. Source (Admin) Logic ---
        const adminPhone = settings.source_phone_number
        const mediaSourcePhone = settings.media_source_number || adminPhone
        const voiceSourcePhone = settings.voice_source_number || adminPhone
        const leadProviderPhone = settings.lead_provider_number || adminPhone

        const cleanSender = normalizedPhone.replace('+', '')

        const isPrivilegedSender =
            (adminPhone && cleanSender === adminPhone.replace('+', '')) ||
            (mediaSourcePhone && cleanSender === mediaSourcePhone.replace('+', '')) ||
            (voiceSourcePhone && cleanSender === voiceSourcePhone.replace('+', '')) ||
            (leadProviderPhone && cleanSender === leadProviderPhone.replace('+', ''))

        if (isPrivilegedSender) {
            console.log(`[Processor] Privileged message from ${normalizedPhone}`)
            const text = messageText
            const sourcePhone = normalizedPhone.split('@')[0]

            // 1. Admin Commands
            const { handleAdminCommand } = require('@/lib/handlers/admin')
            const adminResult = await handleAdminCommand(text, sourcePhone, settings, agentId)
            if (adminResult.handled) return { status: 'handled_admin', type: adminResult.type }

            // 2. Media/Voice Ingestion
            const { handleSourceMedia } = require('@/lib/handlers/media')
            const mediaResult = await handleSourceMedia(payload, sourcePhone, normalizedPhone, settings)
            if (mediaResult.handled) return { status: 'handled_media_ingest', type: mediaResult.type }

            // 3. Lead Provider
            const isLeadProvider = leadProviderPhone && normalizedPhone.includes(leadProviderPhone.replace('+', ''))
            if (isLeadProvider) {
                let content = messageText
                const isAudio = payload.type === 'ptt' || payload.type === 'audio' || payload._data?.mimetype?.startsWith('audio')
                if (isAudio) {
                    console.log('[LeadProvider] Voice detected but transcription is disabled (Cartesia removed).')
                    // Logic to handle audio without transcription or skip
                }

                if (content) {
                    const { leadService } = require('@/lib/leads')
                    await leadService.handleProviderMessage(normalizedPhone, content)
                    return { status: 'handled_lead_provider' }
                }
            }
            return { status: 'ignored_admin_text' }
        }

        // --- 2. User Media Request Logic ---
        const contact = await prisma.contact.upsert({
            where: { phone_whatsapp: normalizedPhone },
            update: {},
            create: {
                phone_whatsapp: normalizedPhone,
                name: payload._data?.notifyName || "Inconnu",
                source: 'WhatsApp Incoming',
                status: 'new'
            }
        })

        const { mediaService } = require('@/lib/media')

        if (payload.type === 'chat') {
            try {
                const analysis = await mediaService.analyzeRequest(messageText)

                if (analysis && analysis.isMediaRequest) {
                    if (!analysis.allowed) {
                        // Refusal Logic
                        const refusalReason = analysis.refusalReason || "forbidden content"
                        const refusalSystemPrompt = `(SYSTEM: User requested FORBIDDEN media. Reason: "${refusalReason}". REFUSE GENTLY. Be shy, hesitant. Lowercase.)`

                        let currentConversation = await prisma.conversation.findFirst({
                            where: { contactId: contact.id, status: { in: ['active', 'paused'] } },
                            include: { prompt: true }
                        })

                        const provider = settings.ai_provider || 'venice'
                        const mainPrompt = currentConversation?.prompt?.system_prompt || "You are a friend."
                        let aiRefusal = ""

                        if (provider === 'anthropic') {
                            aiRefusal = await anthropic.chatCompletion(mainPrompt, [], refusalSystemPrompt, { apiKey: settings.anthropic_api_key, model: settings.anthropic_model })
                        } else {
                            aiRefusal = await venice.chatCompletion(mainPrompt, [], refusalSystemPrompt, { apiKey: settings.venice_api_key, model: settings.venice_model })
                        }

                        await whatsapp.sendText(contact.phone_whatsapp, aiRefusal)
                        // Save Interaction
                        if (currentConversation) {
                            await prisma.message.create({
                                data: {
                                    conversationId: currentConversation.id,
                                    sender: 'ai',
                                    message_text: aiRefusal,
                                    timestamp: new Date()
                                }
                            })
                        }
                        return { status: 'media_request_blocked' }
                    }

                    if (analysis.intentCategory) {
                        const result = await mediaService.processRequest(contact.phone_whatsapp, analysis.intentCategory)

                        if (result.action === 'SEND') {
                            const dataUrl = result.media.url
                            if (dataUrl.startsWith('data:image')) await whatsapp.sendImage(contact.phone_whatsapp, dataUrl)
                            else await whatsapp.sendVideo(contact.phone_whatsapp, dataUrl)

                            await prisma.media.update({
                                where: { id: result.media.id },
                                data: { sentTo: { push: contact.phone_whatsapp } }
                            })

                            // Memory & Logs
                            const { memoryService } = require('@/lib/memory')
                            await memoryService.add(contact.phone_whatsapp, messageText)
                            await memoryService.add(contact.phone_whatsapp, `[System]: Sent media ${analysis.intentCategory}`)

                            const activeConv = await prisma.conversation.findFirst({
                                where: { contactId: contact.id, status: 'active' },
                                select: { id: true }
                            })

                            if (activeConv) {
                                await prisma.message.create({
                                    data: {
                                        conversationId: activeConv.id,
                                        sender: 'ai',
                                        message_text: `[Sent Media: ${analysis.intentCategory}]`,
                                        timestamp: new Date()
                                    }
                                }).catch((e: any) => console.error("Failed to save system media msg", e))
                            }
                            return { status: 'media_sent' }

                        } else if (result.action === 'REQUEST_SOURCE') {
                            const status = await mediaService.requestFromSource(contact.phone_whatsapp, analysis.intentCategory)

                            let currentConversation = await prisma.conversation.findFirst({
                                where: { contactId: contact.id, status: 'active' },
                                include: { prompt: true }
                            })

                            const instruction = status === 'REQUEST_NEW'
                                ? `(SYSTEM: User wants photo of ${analysis.intentCategory}. You don't have it. Say you'll check later. Be natural, shy. Don't say AI.)`
                                : `(SYSTEM: User asking AGAIN for ${analysis.intentCategory}. Tell them to be patient. Be cute.)`;

                            // Generate Response
                            const provider = settings.ai_provider || 'venice'
                            let responseText = ""
                            const userMessageForAI = messageText + "\n\n" + instruction;

                            if (provider === 'anthropic') {
                                responseText = await anthropic.chatCompletion(
                                    currentConversation?.prompt?.system_prompt || "You are a helpful assistant.",
                                    [],
                                    userMessageForAI,
                                    { apiKey: settings.anthropic_api_key, model: settings.anthropic_model || 'claude-3-haiku-20240307' }
                                );
                            } else {
                                responseText = await venice.chatCompletion(
                                    currentConversation?.prompt?.system_prompt || "You are a helpful assistant.",
                                    [],
                                    userMessageForAI,
                                    { apiKey: settings.venice_api_key, model: settings.venice_model || 'venice-uncensored' }
                                );
                            }

                            // Split & Send
                            const parts = responseText.split('|||').filter(p => p.trim().length > 0)
                            for (const part of parts) {
                                await whatsapp.sendTypingState(contact.phone_whatsapp, true)
                                // Simulated Delay
                                await new Promise(r => setTimeout(r, 2000))
                                await whatsapp.sendText(contact.phone_whatsapp, part.trim())
                            }

                            if (currentConversation) {
                                await prisma.message.create({
                                    data: { conversationId: currentConversation.id, sender: 'ai', message_text: responseText.replace(/\|\|\|/g, '\n'), timestamp: new Date() }
                                })
                                await prisma.message.create({
                                    data: { conversationId: currentConversation.id, sender: 'contact', message_text: messageText, timestamp: new Date() }
                                })
                            }

                            return { status: 'media_request_pending' }
                        }
                    }
                }
            } catch (mediaError) {
                console.error('[Processor] Media Logic Error:', mediaError)
            }
        }

        // --- 3. Chat Logic ---
        // Find existing Conversation (Active OR Paused)
        let conversation = await prisma.conversation.findFirst({
            where: {
                contactId: contact.id,
                agentId: agentId,
                status: { in: ['active', 'paused'] }
            },
            orderBy: { createdAt: 'desc' },
            include: { prompt: true }
        })

        if (!conversation) {
            const defaultPrompt = await prisma.prompt.findFirst({ where: { isActive: true } }) || await prisma.prompt.findFirst()
            if (!defaultPrompt) throw new Error('No prompt configured')

            conversation = await prisma.conversation.create({
                data: {
                    contactId: contact.id,
                    promptId: defaultPrompt.id,
                    agentId: agentId,
                    status: 'paused',
                    ai_enabled: true
                },
                include: { prompt: true }
            })
        }

        const { handleChat } = require('@/lib/handlers/chat')
        const chatResult = await handleChat(payload, contact, conversation, settings, messageText, agentId)

        return { status: chatResult.result }

    } catch (error: any) {
        console.error('[Processor] Fatal Error:', error)
        throw error
    }
}
