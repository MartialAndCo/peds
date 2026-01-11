import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { anthropic } from '@/lib/anthropic'
import { whatsapp } from '@/lib/whatsapp'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { settingsService } from '@/lib/settings-cache'

/**
 * Core processor for WhatsApp Webhook Payloads.
 * This function encapsulates the business logic previously in the route handler.
 */
export async function processWhatsAppPayload(payload: any, agentId: number) {
    logger.messageProcessing('Start handling message', { agentId, from: payload.from })

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
            logger.debug('Ignored non-user JID', { from, module: 'processor' })
            return { status: 'ignored_group' }
        }

        // Standardize phone number or LID
        let normalizedPhone = `+${from.split('@')[0]}`

        if (from.includes('@lid')) {
            // LID Handling - Try to resolve to phone number
            if (payload._data?.phoneNumber) {
                logger.debug('Replacing LID with resolved phone number', { lid: from, pn: payload._data.phoneNumber, module: 'processor' })
                const pn = payload._data.phoneNumber.replace('@s.whatsapp.net', '').replace('@c.us', '')
                normalizedPhone = pn.startsWith('+') ? pn : `+${pn}`
            } else {
                // No phone number available, use LID as identifier
                // This allows the system to work even when LID cannot be resolved
                logger.debug('Using LID as identifier (phone number not available)', { lid: from, module: 'processor' })
                normalizedPhone = from // Use the full LID as identifier (e.g., "76712679350466@lid")
            }
        }

        // Fetch Settings Early
        const settings = await settingsService.getSettings()
        console.log('[Processor] DB Settings fetched successfully')

        // ...

        // ... (Wait, I need to remove the broken async processMessage block that was pasted inside processWhatsAppPayload)

        // Fetch Settings (Cached)
        // ALREADY FETCHED ABOVE AS 'settings'

        // Fetch Agent-Specific Settings (Overrides Global)

        // Fetch Agent-Specific Settings (Overrides Global)
        console.log(`[Processor] Fetching agent settings for ID ${agentId}...`)
        const agentWithSettings = await prisma.agent.findUnique({
            where: { id: Number(agentId) },
            include: { settings: true }
        })
        console.log(`[Processor] Agent settings fetch complete. Found: ${!!agentWithSettings}`)

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
            logger.info('Privileged message detected', { from: normalizedPhone, module: 'processor' })
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
                    logger.warn('Voice detected from lead provider but transcription is disabled', { module: 'processor' })
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
        // Track if we resolved a real phone number from LID (for updating existing contacts)
        const wasLidResolved = from.includes('@lid') && payload._data?.phoneNumber

        const contact = await prisma.contact.upsert({
            where: { phone_whatsapp: normalizedPhone },
            update: {
                // Update the phone number if we resolved it from LID
                ...(wasLidResolved ? { phone_whatsapp: normalizedPhone } : {})
            },
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
                logger.error('Media logic error', mediaError as Error, { module: 'processor' })
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

        console.log('[Processor] Handing off to Chat Handler...')
        const { handleChat } = require('@/lib/handlers/chat')
        const chatResult = await handleChat(payload, contact, conversation, settings, messageText, agentId)
        console.log('[Processor] Chat Result:', chatResult)

        return { status: chatResult.result }

    } catch (error: any) {
        logger.error('Processor fatal error', error, { module: 'processor', agentId })
        throw error
    }
}
