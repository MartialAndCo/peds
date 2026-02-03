import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { anthropic } from '@/lib/anthropic'
import { whatsapp } from '@/lib/whatsapp'
import { discord } from '@/lib/discord'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { settingsService } from '@/lib/settings-cache'
import { queueService } from '@/lib/services/queue-service'

/**
 * Core processor for WhatsApp Webhook Payloads.
 * This function encapsulates the business logic previously in the route handler.
 */
export async function processWhatsAppPayload(payload: any, agentId: string, options?: { skipAI?: boolean, previousResponse?: string }) {
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


        let from = payload.from // e.g. 33612345678@c.us or @s.whatsapp.net or DISCORD_123@discord

        // --- PLATFORM DETECTION ---
        const isDiscord = from.includes('@discord') || from.startsWith('DISCORD_') || payload._data?.platform === 'discord'
        const platform = isDiscord ? 'discord' : 'whatsapp'

        if (isDiscord) {
            console.log('[Processor] Discord message detected')
        }

        // Normalize if coming from raw Baileys (WhatsApp only)
        if (!isDiscord && from.includes('@s.whatsapp.net')) {
            from = from.replace('@s.whatsapp.net', '@c.us')
        }

        // For Discord, accept @discord suffix
        // For WhatsApp, require @c.us or @lid
        if (!isDiscord) {
            if (from.includes('@lid')) {
                // LID Handling - continue below
            } else if (!from.includes('@c.us')) {
                logger.debug('Ignored non-user JID', { from, module: 'processor' })
                return { status: 'ignored_group' }
            }
        }

        // Standardize phone number or LID or Discord ID
        let normalizedPhone = `+${from.split('@')[0]}`

        // Discord: Use DISCORD_ prefix as identifier
        if (isDiscord) {
            const discordId = from.replace('@discord', '').replace('DISCORD_', '')
            normalizedPhone = `DISCORD_${discordId}`
            console.log(`[Processor] Normalized Discord ID: ${normalizedPhone}`)
        } else if (from.includes('@lid')) {
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

        // Helper function to send text via correct platform
        const sendText = async (phone: string, text: string, replyTo?: string) => {
            if (platform === 'discord') {
                return discord.sendText(phone, text, agentId)
            } else {
                return whatsapp.sendText(phone, text, replyTo, agentId)
            }
        }

        // Helper to mark as read (WhatsApp only for now)
        const markAsRead = async (phone: string) => {
            if (platform === 'whatsapp') {
                return whatsapp.markAsRead(phone).catch(() => { })
            }
            return Promise.resolve()
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
            where: { id: agentId },
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
                    await leadService.handleProviderMessage(normalizedPhone, content, payload.id, agentId)
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

        const isSystemNumber =
            (adminPhone && cleanSender === adminPhone.replace('+', '')) ||
            (mediaSourcePhone && cleanSender === mediaSourcePhone.replace('+', '')) ||
            (voiceSourcePhone && cleanSender === voiceSourcePhone.replace('+', '')) ||
            (leadProviderPhone && cleanSender === leadProviderPhone.replace('+', ''));

        // --- DISCORD-WHATSAPP BRIDGING ---
        // For Discord users, first try to find by discordId, then create if not found
        let contact;

        if (isDiscord) {
            const discordId = normalizedPhone.replace('DISCORD_', '')

            // First: Check if this Discord user already has a linked contact
            contact = await prisma.contact.findFirst({
                where: { discordId }
            })

            if (contact) {
                console.log(`[Processor] Found linked contact for Discord user ${discordId}: ${contact.phone_whatsapp}`)
            } else {
                // Create a new contact with Discord as primary identifier
                // phone_whatsapp will be the Discord ID temporarily until they provide their number
                contact = await prisma.contact.create({
                    data: {
                        phone_whatsapp: normalizedPhone, // DISCORD_123456
                        discordId: discordId,
                        name: payload._data?.notifyName || "Discord User",
                        source: 'Discord Incoming',
                        status: 'new'
                    }
                })
                console.log(`[Processor] Created Discord contact: ${contact.id}`)
            }
        } else {
            // Standard WhatsApp flow
            contact = await prisma.contact.upsert({
                where: { phone_whatsapp: normalizedPhone },
                update: {
                    // Update the phone number if we resolved it from LID
                    ...(wasLidResolved ? { phone_whatsapp: normalizedPhone } : {}),
                    // Ensure system numbers stay hidden if they were somehow unhidden? Or just set it?
                    // Better to just set it on create, but maybe update too if it became a system number?
                    ...(isSystemNumber ? { isHidden: true } : {})
                },
                create: {
                    phone_whatsapp: normalizedPhone,
                    name: payload._data?.notifyName || "Inconnu",
                    source: 'WhatsApp Incoming',
                    status: 'new',
                    isHidden: isSystemNumber || false
                }
            })
        }

        const { mediaService } = require('@/lib/media')

        if (payload.type === 'chat') {
            try {
                // Fetch conversation and history BEFORE media analysis (needed for paywall detection)
                let currentConversation = await prisma.conversation.findFirst({
                    where: {
                        contactId: contact.id,
                        agentId: agentId,
                        status: { in: ['active', 'paused'] }
                    },
                    include: { prompt: true }
                })

                // Build conversation history for context-aware paywall detection
                const lastMessages = currentConversation ? await prisma.message.findMany({
                    where: { conversationId: currentConversation.id },
                    orderBy: { timestamp: 'desc' },
                    take: 10
                }) : []
                const history = lastMessages.reverse().map(m => ({
                    role: m.sender === 'contact' ? 'user' : 'assistant',
                    content: m.message_text
                }))

                // Analyze with conversation context for smart paywall detection
                const analysis = await mediaService.analyzeRequest(messageText, contact.phone_whatsapp, agentId, history)

                if (analysis && analysis.isMediaRequest) {
                    // =============================================================
                    // PAYWALL TRIGGERED: User requested blocked content BUT offered payment
                    // =============================================================
                    if (analysis.paywallTriggered) {
                        console.log('[WhatsApp] PAYWALL TRIGGERED - User offered payment for blocked content')

                        const paywallSystemPrompt = `(SYSTEM: User wants to PAY for content. They offered money. 
You should ACCEPT with enthusiasm but DEMAND PAYMENT FIRST before sending anything.
Say something like: "omg sérieux? 😍 ok mais envoie l'argent d'abord et après je t'envoie" 
DO NOT send the content yet. Wait for payment confirmation.
Keep response SHORT and excited.)`

                        // Use Director to build full prompt
                        const { director } = require('@/lib/director')
                        const { phase, details, reason } = await director.determinePhase(contact.phone_whatsapp, agentId)
                        const fullSystemPrompt = await director.buildSystemPrompt(
                            settings,
                            contact,
                            phase,
                            details,
                            currentConversation?.prompt?.system_prompt || "You are a friend.",
                            agentId,
                            reason
                        )

                        const provider = settings.ai_provider || 'venice'
                        let aiPaywallResponse = ""
                        const userMessageWithInstruction = `${messageText}\n\n${paywallSystemPrompt}`

                        if (provider === 'anthropic') {
                            aiPaywallResponse = await anthropic.chatCompletion(fullSystemPrompt, history, userMessageWithInstruction, { apiKey: settings.anthropic_api_key, model: settings.anthropic_model })
                        } else {
                            aiPaywallResponse = await venice.chatCompletion(fullSystemPrompt, history, userMessageWithInstruction, { apiKey: settings.venice_api_key, model: settings.venice_model })
                        }

                        await whatsapp.markAsRead(contact.phone_whatsapp).catch(() => { })
                        await whatsapp.sendText(contact.phone_whatsapp, aiPaywallResponse, undefined, agentId)

                        if (currentConversation) {
                            await prisma.message.create({
                                data: {
                                    conversationId: currentConversation.id,
                                    sender: 'ai',
                                    message_text: aiPaywallResponse,
                                    status: 'SENT'
                                }
                            })
                        }
                        return null // Short-circuit - paywall handled
                    }

                    // =============================================================
                    // NORMAL REFUSAL: Blocked content, no payment offered
                    // =============================================================
                    if (!analysis.allowed) {
                        // Refusal Logic
                        const refusalReason = analysis.refusalReason || "forbidden content"
                        const refusalSystemPrompt = `(SYSTEM: User requested FORBIDDEN media. Reason: "${refusalReason}". YOU MUST REFUSE GENTLY. Do not preach. Be shy/hesitant if that fits your role. Keep it SHORT.)`

                        let currentConversation = await prisma.conversation.findFirst({
                            where: {
                                contactId: contact.id,
                                agentId: agentId,
                                status: { in: ['active', 'paused'] }
                            },
                            include: { prompt: true }
                        })

                        // Use Director to build FULL prompt (Phases, Style, etc.)
                        const { director } = require('@/lib/director')
                        const { phase, details, reason } = await director.determinePhase(contact.phone_whatsapp, agentId)
                        const fullSystemPrompt = await director.buildSystemPrompt(
                            settings,
                            contact,
                            phase,
                            details,
                            currentConversation?.prompt?.system_prompt || "You are a friend.",
                            agentId,
                            reason
                        )

                        // Pass Refusal Instruction as USER message to override behavior
                        // We use the last few messages for context
                        const lastMessages = await prisma.message.findMany({
                            where: { conversationId: currentConversation?.id },
                            orderBy: { timestamp: 'desc' },
                            take: 10
                        });
                        const history = lastMessages.reverse().map(m => ({
                            role: m.sender === 'contact' ? 'user' : 'assistant',
                            content: m.message_text
                        }));

                        const provider = settings.ai_provider || 'venice'
                        let aiRefusal = ""
                        const userMessageWithInstruction = `${messageText}\n\n${refusalSystemPrompt}`

                        if (provider === 'anthropic') {
                            aiRefusal = await anthropic.chatCompletion(fullSystemPrompt, history, userMessageWithInstruction, { apiKey: settings.anthropic_api_key, model: settings.anthropic_model })
                        } else {
                            aiRefusal = await venice.chatCompletion(fullSystemPrompt, history, userMessageWithInstruction, { apiKey: settings.venice_api_key, model: settings.venice_model })
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

                            // Fix: Don't assume everything that isn't data:image is a video.
                            // Check extension or context match.
                            const isDataImage = dataUrl.startsWith('data:image')
                            const isVideoExt = dataUrl.match(/\.(mp4|mov|avi|webm|mkv)(\?|$)/i)
                            const isVideoIntent = analysis.intentCategory?.toLowerCase().includes('video')

                            const shouldSendAsVideo = !isDataImage && (isVideoExt || isVideoIntent)

                            if (shouldSendAsVideo) {
                                await whatsapp.sendVideo(contact.phone_whatsapp, dataUrl, undefined, agentId)
                            } else {
                                await whatsapp.sendImage(contact.phone_whatsapp, dataUrl, undefined, agentId)
                            }

                            await prisma.media.update({
                                where: { id: result.media.id },
                                data: { sentTo: { push: contact.phone_whatsapp } }
                            })

                            // Memory & Logs
                            const { memoryService } = require('@/lib/memory')
                            await memoryService.add(contact.phone_whatsapp, messageText)
                            await memoryService.add(contact.phone_whatsapp, `[System]: Sent media ${analysis.intentCategory}`)

                            const activeConv = await prisma.conversation.findFirst({
                                where: {
                                    contactId: contact.id,
                                    agentId: agentId,
                                    status: 'active'
                                },
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
                                where: {
                                    contactId: contact.id,
                                    agentId: agentId,
                                    status: 'active'
                                },
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

                            // Generate Response using Director for Consistency
                            const { director } = require('@/lib/director')
                            const { phase, details, reason } = await director.determinePhase(contact.phone_whatsapp, agentId)
                            const fullSystemPrompt = await director.buildSystemPrompt(
                                settings,
                                contact,
                                phase,
                                details,
                                currentConversation?.prompt?.system_prompt || "You are a friend.",
                                agentId,
                                reason
                            )

                            const provider = settings.ai_provider || 'venice'
                            let responseText = ""
                            const userMessageForAI = messageText + "\n\n" + instruction;

                            if (provider === 'anthropic') {
                                responseText = await anthropic.chatCompletion(
                                    fullSystemPrompt,
                                    history,
                                    userMessageForAI,
                                    { apiKey: settings.anthropic_api_key, model: settings.anthropic_model || 'claude-3-haiku-20240307' }
                                );
                            } else {
                                responseText = await venice.chatCompletion(
                                    fullSystemPrompt,
                                    history,
                                    userMessageForAI,
                                    { apiKey: settings.venice_api_key, model: settings.venice_model || 'venice-uncensored' }
                                );
                            }

                            // Split & Send
                            const parts = responseText.split(/\|+/).filter(p => p.trim().length > 0)
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

            // --- WAKE UP LOGIC ---
            // If conversation is paused waiting for lead, UNPAUSE it now because we received a message!
            const meta = conversation.metadata as any

            // Log for debugging
            if (conversation.status === 'paused') {
                console.log(`[Processor] Conversation ${conversation.id} is PAUSED. Checking for WAITING_FOR_LEAD... Meta state: ${meta?.state}`)
            }

            if (conversation.status === 'paused' && meta?.state === 'WAITING_FOR_LEAD') {
                console.log(`[Processor] Waking up conversation ${conversation.id} (Lead initiated contact)`)
                conversation = await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: {
                        status: 'active',
                        metadata: {
                            ...meta,
                            state: 'active', // clear waiting state
                            becameActiveAt: new Date()
                        }
                    },
                    include: { prompt: true }
                })
            }
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
