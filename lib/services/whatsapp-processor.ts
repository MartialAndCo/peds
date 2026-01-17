import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { anthropic } from '@/lib/anthropic'
import { whatsapp } from '@/lib/whatsapp'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { settingsService } from '@/lib/settings-cache'
import { queueService } from '@/lib/services/queue-service'

/**
 * Core processor for WhatsApp Webhook Payloads.
 * This function encapsulates the business logic previously in the route handler.
 */
export async function processWhatsAppPayload(payload: any, agentId: number, options?: { skipAI?: boolean, previousResponse?: string }) {
    logger.messageProcessing('Start handling message', { agentId, from: payload.from })

    try {

        // Ignore own messages (unless it's a status update for our own message)
        if (payload.fromMe && payload.event !== 'message.update') return { status: 'ignored_from_me' }

        // --- NEW: Status Update Handling ---
        if (payload.event === 'message.update') {
            const { id, status } = payload.payload;
            if (id && status) {
                logger.info('Updating message status', { id, status, module: 'processor' });
                await prisma.message.updateMany({
                    where: { waha_message_id: id },
                    data: { status: status }
                });
                return { status: 'status_updated' };
            }
            return { status: 'ignored_update_no_data' };
        }
        // -----------------------------------

        // Ignore own messages (unless it's a status update for our own message)
        if (payload.fromMe && payload.event !== 'message.update') return { status: 'ignored_from_me' }

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
        // NOTE: mediaSourcePhone does NOT fallback to admin - if not set, media requests will fail
        const mediaSourcePhone = settings.media_source_number
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
            const adminResult = await handleAdminCommand(text, sourcePhone, settings, agentId, payload.messageKey)
            if (adminResult.handled) return { status: 'handled_admin', type: adminResult.type }

            // 2. Media/Voice Ingestion
            const { handleSourceMedia } = require('@/lib/handlers/media')
            const mediaResult = await handleSourceMedia(payload, sourcePhone, normalizedPhone, settings, agentId)
            if (mediaResult.handled) {
                await queueService.processPendingMessages().catch((err: any) => console.error('[Processor] Queue Worker failed:', err))
                return { status: 'handled_media_ingest', type: mediaResult.type }
            }

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

        // 2a. Self-Healing: Merge Ghost Contact if LID is resolved
        if (wasLidResolved) {
            const lidJid = from // e.g. 767...@lid
            try {
                // Check if a ghost contact exists with phone_whatsapp = LID
                const ghostContact = await prisma.contact.findUnique({ where: { phone_whatsapp: lidJid } })

                if (ghostContact) {
                    logger.info('Healing: Found duplicate ghost contact for LID', { lid: lidJid, realPhone: normalizedPhone })

                    // Check if real contact already exists
                    const existingRealContact = await prisma.contact.findUnique({ where: { phone_whatsapp: normalizedPhone } })

                    let realContact
                    if (existingRealContact) {
                        // Real contact exists - merge ghost data INTO it (preserve real's existing data, fill gaps from ghost)
                        realContact = await prisma.contact.update({
                            where: { phone_whatsapp: normalizedPhone },
                            data: {
                                // Only fill in empty fields from ghost contact
                                name: existingRealContact.name || ghostContact.name,
                                notes: existingRealContact.notes || ghostContact.notes,
                                profile: (existingRealContact.profile || ghostContact.profile) as any,
                                source: existingRealContact.source || ghostContact.source,
                                status: existingRealContact.status !== 'new' ? existingRealContact.status : ghostContact.status,
                                agentPhase: existingRealContact.agentPhase !== 'CONNECTION' ? existingRealContact.agentPhase : ghostContact.agentPhase,
                                trustScore: existingRealContact.trustScore > 0 ? existingRealContact.trustScore : ghostContact.trustScore,
                                testMode: existingRealContact.testMode || ghostContact.testMode,
                                isHidden: existingRealContact.isHidden || ghostContact.isHidden,
                            }
                        })
                        logger.info('Healing: Merged ghost metadata into existing contact', { ghostId: ghostContact.id, realId: realContact.id })
                    } else {
                        // Real contact doesn't exist - copy EVERYTHING from ghost with new phone number
                        realContact = await prisma.contact.create({
                            data: {
                                phone_whatsapp: normalizedPhone,
                                name: ghostContact.name || payload._data?.notifyName || "Inconnu",
                                notes: ghostContact.notes,
                                profile: ghostContact.profile as any,
                                source: ghostContact.source || 'WhatsApp Incoming (Healed)',
                                status: ghostContact.status,
                                agentPhase: ghostContact.agentPhase,
                                trustScore: ghostContact.trustScore,
                                lastPhaseUpdate: ghostContact.lastPhaseUpdate,
                                lastTrustAnalysis: ghostContact.lastTrustAnalysis,
                                testMode: ghostContact.testMode,
                                isHidden: ghostContact.isHidden,
                            }
                        })
                        logger.info('Healing: Created real contact with all ghost metadata', { ghostId: ghostContact.id, realId: realContact.id })
                    }

                    // Move Conversations
                    await prisma.conversation.updateMany({
                        where: { contactId: ghostContact.id },
                        data: { contactId: realContact.id }
                    })

                    // Move MessageQueue items
                    await prisma.messageQueue.updateMany({
                        where: { contactId: ghostContact.id },
                        data: { contactId: realContact.id }
                    })

                    // Move Payments
                    await prisma.payment.updateMany({
                        where: { contactId: ghostContact.id },
                        data: { contactId: realContact.id }
                    })

                    // Mark ghost as merged (DON'T delete - preserves links)
                    await prisma.contact.update({
                        where: { id: ghostContact.id },
                        data: {
                            status: 'merged',
                            mergedIntoId: realContact.id,
                            isHidden: true // Hide from listings
                        }
                    })
                    logger.info('Healing: Ghost contact marked as merged', { ghostId: ghostContact.id, realId: realContact.id })
                }
            } catch (e) {
                logger.error('Healing: Failed to merge duplicate contacts', e as Error)
            }
        }

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

                        await whatsapp.markAsRead(contact.phone_whatsapp).catch(() => { })
                        await whatsapp.sendText(contact.phone_whatsapp, aiRefusal, undefined, agentId)
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
                            await whatsapp.markAsRead(contact.phone_whatsapp).catch(() => { })

                            if (dataUrl.startsWith('data:image')) await whatsapp.sendImage(contact.phone_whatsapp, dataUrl, undefined, agentId)
                            else await whatsapp.sendVideo(contact.phone_whatsapp, dataUrl, undefined, agentId)

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
                                        mediaUrl: result.media.url || dataUrl, // Add mediaUrl here
                                        timestamp: new Date()
                                    }
                                }).catch((e: any) => console.error("Failed to save system media msg", e))
                            }
                            return { status: 'media_sent' }

                        } else if (result.action === 'REQUEST_SOURCE') {
                            const status = await mediaService.requestFromSource(contact.phone_whatsapp, analysis.intentCategory, settings, agentId)

                            let currentConversation = await prisma.conversation.findFirst({
                                where: { contactId: contact.id, status: 'active' },
                                include: { prompt: true }
                            })

                            // FIX: Fetch conversation history to maintain persona
                            const lastMessages = await prisma.message.findMany({
                                where: { conversationId: currentConversation?.id },
                                orderBy: { timestamp: 'desc' },
                                take: 15 // Enough for persona, not too much
                            })
                            const history = lastMessages.reverse().map((m: any) => ({
                                role: m.sender === 'contact' ? 'user' : 'assistant',
                                content: m.message_text
                            }))

                            // Simplified instruction - agent-agnostic, stays in persona
                            const instruction = status === 'REQUEST_NEW'
                                ? `(SYSTEM: Say you'll check for that later. Keep response SHORT, max 15 words. Stay in character.)`
                                : `(SYSTEM: They're asking again. Say be patient. Keep response SHORT, max 15 words. Stay in character.)`;

                            // Generate Response
                            const provider = settings.ai_provider || 'venice'
                            let responseText = ""
                            const userMessageForAI = messageText + "\n\n" + instruction;

                            if (provider === 'anthropic') {
                                responseText = await anthropic.chatCompletion(
                                    currentConversation?.prompt?.system_prompt || "You are a helpful assistant.",
                                    history, // <-- Pass history!
                                    userMessageForAI,
                                    { apiKey: settings.anthropic_api_key, model: settings.anthropic_model || 'claude-3-haiku-20240307' }
                                );
                            } else {
                                responseText = await venice.chatCompletion(
                                    currentConversation?.prompt?.system_prompt || "You are a helpful assistant.",
                                    history, // <-- Pass history!
                                    userMessageForAI,
                                    { apiKey: settings.venice_api_key, model: settings.venice_model || 'venice-uncensored' }
                                );
                            }

                            // Split & Send
                            const parts = responseText.split('|||').filter(p => p.trim().length > 0)
                            for (const part of parts) {
                                await whatsapp.sendTypingState(contact.phone_whatsapp, true, agentId)
                                // Simulated Delay
                                await new Promise(r => setTimeout(r, 2000))
                                await whatsapp.markAsRead(contact.phone_whatsapp).catch(() => { })
                                await whatsapp.sendText(contact.phone_whatsapp, part.trim(), undefined, agentId)
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
        console.log(`[Processor] Searching for conversation for Contact ${contact.id} and Agent ${agentId}...`)
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
            console.log('[Processor] No existing conversation found. Creating NEW one (Default: PAUSED)...')
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
            console.log(`[Processor] New Conversation Created: ID ${conversation.id}, Status: ${conversation.status}`)
        } else {
            console.log(`[Processor] Found Existing Conversation: ID ${conversation.id}, Status: ${conversation.status}`)
        }

        console.log('[Processor] Handing off to Chat Handler...')
        const { handleChat } = require('@/lib/handlers/chat')

        // CONTEXT INJECTION: If this processor instance just generated a response (e.g. from Media Request or previous burst part),
        // we should pass it to handleChat so it doesn't repeat itself.
        // Currently, media request Logic returns early, so we only need to worry about BURST logic which handles this inside the CRON loop.
        // The CRON loop will pass `lastResponse` in `options`.

        const chatResult = await handleChat(payload, contact, conversation, settings, messageText, agentId, options)
        console.log('[Processor] Chat Result:', chatResult)

        // ...

        // TRIGGER QUEUE WORKER (Direct Call)
        // We call the service directly to ensure it runs within the function execution.
        if (chatResult?.result === 'sent' || chatResult?.result === 'queued') {
            console.log('[Processor] Starting Queue Worker (Direct Execution)...')
            // We await it to ensure it finishes before Lambda freeze, 
            // BUT we catch errors so we don't crash the webhook response.
            await queueService.processPendingMessages().catch(err => console.error('[Processor] Queue Worker failed:', err))
            console.log('[Processor] Queue Worker finished.')
        }

        // AUTO-RECOVERY: TEMPORARILY DISABLED to debug duplicate conversation issue
        // TODO: Re-enable after fixing the issue
        // const { messageRecoveryService } = require('@/lib/services/message-recovery')
        // messageRecoveryService.recoverOrphanMessages()
        //     .then((result: any) => {
        //         if (result.recovered > 0) {
        //             console.log(`[Processor] Auto-recovery: Recovered ${result.recovered} orphan messages`)
        //         }
        //     })
        //     .catch((err: any) => console.error('[Processor] Auto-recovery failed (non-blocking):', err.message))

        return {
            status: chatResult.result,
            jobId: chatResult.jobId,
            conversationId: conversation.id,
            textBody: chatResult.textBody // Pass through the generated text
        }

    } catch (error: any) {
        logger.error('Processor fatal error', error, { module: 'processor', agentId })
        throw error
    }
}
