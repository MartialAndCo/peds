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
                // Queue processing handled by CRON (every 10s) — no direct call to avoid race conditions
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
                                source: ghostContact.source === 'system' ? 'system' : (ghostContact.source || 'WhatsApp Incoming (Healed)'),
                                status: ghostContact.status,
                                agentPhase: ghostContact.agentPhase,
                                trustScore: ghostContact.trustScore,
                                lastPhaseUpdate: ghostContact.lastPhaseUpdate,
                                lastTrustAnalysis: ghostContact.lastTrustAnalysis,
                                testMode: ghostContact.testMode,

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
                            source: 'system', // Hide merged ghosts from listings

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

            // First: Check if this Discord user already has a linked contact FOR THIS AGENT
            // Critical: Must filter by agent to prevent cross-agent contact leakage
            contact = await prisma.contact.findFirst({
                where: {
                    discordId,
                    agentContacts: {
                        some: { agentId }
                    }
                }
            })

            if (contact) {
                console.log(`[Processor] Found linked contact for Discord user ${discordId}: ${contact.phone_whatsapp}`)

                // Activate contact when they send first message (lead is now engaged)
                if (contact.status === 'paused' || contact.status === 'new' || contact.status === 'unknown') {
                    await prisma.contact.update({
                        where: { id: contact.id },
                        data: { status: 'active' }
                    })
                    console.log(`[Processor] Discord contact ${contact.id} marked as active`)

                    // Update lead status to CONVERTED if it exists and is still IMPORTED
                    const lead = await prisma.lead.findFirst({
                        where: {
                            contactId: contact.id,
                            status: 'IMPORTED'
                        }
                    })
                    if (lead) {
                        await prisma.lead.update({
                            where: { id: lead.id },
                            data: { status: 'CONVERTED', paidAt: new Date() }
                        })
                        console.log(`[Processor] Lead ${lead.id} marked as CONVERTED`)
                    }
                }

                // Ensure AgentContact exists for proper workspace filtering
                const existingAgentContact = await prisma.agentContact.findUnique({
                    where: { agentId_contactId: { agentId, contactId: contact.id } }
                })
                if (!existingAgentContact) {
                    await prisma.agentContact.create({
                        data: {
                            agentId,
                            contactId: contact.id,
                            phase: 'CONNECTION'
                        }
                    })
                    console.log(`[Processor] Created AgentContact for existing ${contact.id} -> ${agentId}`)
                }
            } else {
                // Second: Try to find by username (name) where discordId is null
                // This links provider-created leads when Discord user first messages
                // CRITICAL: Must only find leads assigned to THIS agent
                const discordUsername = payload._data?.notifyName
                if (discordUsername) {
                    const normalizedUsername = discordUsername.replace(/\s/g, '').toLowerCase()
                    contact = await prisma.contact.findFirst({
                        where: {
                            name: normalizedUsername,
                            discordId: null,
                            agentContacts: {
                                some: { agentId }
                            }
                        }
                    })

                    if (contact) {
                        console.log(`[Processor] Found unlinked lead for Discord user ${discordUsername}: ${contact.id}`)

                        // Get the lead to check its agentId (any status, not just IMPORTED)
                        const lead = await prisma.lead.findFirst({
                            where: {
                                contactId: contact.id,
                                agentId: agentId  // Ensure lead belongs to this agent
                            }
                        })

                        // If lead has different agent, update agentId for this message processing
                        // CRITICAL: This ensures we use the correct agentId to find the conversation
                        if (lead && lead.agentId !== agentId) {
                            console.log(`[Processor] Lead agent (${lead.agentId}) differs from resolved agent (${agentId}). Using lead agent.`)
                            agentId = lead.agentId
                        }

                        // Link the contact with the real Discord ID
                        contact = await prisma.contact.update({
                            where: { id: contact.id },
                            data: {
                                discordId: discordId,
                                phone_whatsapp: normalizedPhone, // DISCORD_123456
                                status: 'active',
                                source: contact.source || 'Discord Lead (Linked)'
                            }
                        })
                        console.log(`[Processor] Linked lead ${contact.id} with Discord ID ${discordId}`)

                        // Create AgentContact binding if it doesn't exist for this agent
                        // This is critical for proper workspace filtering
                        const existingAgentContact = await prisma.agentContact.findUnique({
                            where: { agentId_contactId: { agentId, contactId: contact.id } }
                        })
                        if (!existingAgentContact) {
                            await prisma.agentContact.create({
                                data: {
                                    agentId,
                                    contactId: contact.id,
                                    phase: 'CONNECTION'
                                }
                            })
                            console.log(`[Processor] Created AgentContact for ${contact.id} -> ${agentId}`)
                        }

                        // Update lead status to CONVERTED if still IMPORTED
                        if (lead && lead.status === 'IMPORTED') {
                            await prisma.lead.update({
                                where: { id: lead.id },
                                data: { status: 'CONVERTED', paidAt: new Date() }
                            })
                            console.log(`[Processor] Lead ${lead.id} marked as CONVERTED`)
                        }
                    }
                }

                // If still no contact, create new one
                if (!contact) {
                    contact = await prisma.contact.create({
                        data: {
                            phone_whatsapp: normalizedPhone, // DISCORD_123456
                            discordId: discordId,
                            name: payload._data?.notifyName || "Discord User",
                            source: isSystemNumber ? 'system' : 'Discord Incoming',
                            status: 'active', // ACTIVE immediately since user just sent a message

                        }
                    })
                    console.log(`[Processor] Created Discord contact: ${contact.id}`)

                    // Create AgentContact binding to ensure proper filtering in workspace
                    try {
                        await prisma.agentContact.create({
                            data: {
                                agentId: agentId,
                                contactId: contact.id,
                                phase: 'CONNECTION'
                            }
                        })
                        console.log(`[Processor] Created AgentContact for ${contact.id} -> ${agentId}`)
                    } catch (e) {
                        // Ignore if already exists
                        console.log(`[Processor] AgentContact may already exist or error:`, e)
                    }
                }
            }
        } else {
            // Standard WhatsApp flow
            contact = await prisma.contact.upsert({
                where: { phone_whatsapp: normalizedPhone },
                update: {
                    // Update the phone number if we resolved it from LID
                    ...(wasLidResolved ? { phone_whatsapp: normalizedPhone } : {}),
                },
                create: {
                    phone_whatsapp: normalizedPhone,
                    name: payload._data?.notifyName || "Inconnu",
                    source: isSystemNumber ? 'system' : 'WhatsApp Incoming',
                    status: 'unknown',  // Not a lead, came from spontaneous message
                }
            })
        }

        // Hard ignore blocked/archived/merged contacts before any activation/media/AI logic.
        if (['blacklisted', 'archive', 'merged'].includes(contact.status)) {
            logger.info('Incoming message ignored due to contact status', {
                module: 'processor',
                contactId: contact.id,
                status: contact.status
            })
            return { status: 'ignored_contact_status' }
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

                // CRITICAL: Wake up WAITING_FOR_LEAD conversations BEFORE media analysis
                // Media analysis can return early (paywall, refusal, send, request) and skip
                // the main wake-up logic at line ~820. We must activate here first.
                if (currentConversation?.status === 'paused') {
                    const convMeta = (currentConversation.metadata || {}) as any
                    if (convMeta?.state === 'WAITING_FOR_LEAD') {
                        console.log(`[Processor][Pre-Media] ⚡ Waking WAITING_FOR_LEAD conversation ${currentConversation.id}`)
                        try {
                            currentConversation = await prisma.conversation.update({
                                where: { id: currentConversation.id },
                                data: {
                                    status: 'active',
                                    metadata: {
                                        ...convMeta,
                                        state: 'active',
                                        becameActiveAt: new Date(),
                                        wokenBy: 'pre_media_analysis'
                                    }
                                },
                                include: { prompt: true }
                            })
                            console.log(`[Processor][Pre-Media] ✅ Conversation ${currentConversation.id} woken up`)
                        } catch (preWakeErr) {
                            console.error(`[Processor][Pre-Media] ❌ Failed to wake conversation:`, preWakeErr)
                        }
                    }

                    // Also activate the contact if needed
                    if (['new', 'unknown', 'paused'].includes(contact.status)) {
                        try {
                            contact = await prisma.contact.update({
                                where: { id: contact.id },
                                data: { status: 'active' }
                            })
                            console.log(`[Processor][Pre-Media] ✅ Contact ${contact.id} activated`)
                        } catch (e) {
                            console.error(`[Processor][Pre-Media] ❌ Failed to activate contact:`, e)
                        }
                    }
                }

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
                const contactPhone = contact.phone_whatsapp || ''
                const analysis = await mediaService.analyzeRequest(messageText, contactPhone, agentId, history)

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
                        const contactPhone = contact.phone_whatsapp || ''
                        const { phase, details, reason } = await director.determinePhase(contactPhone, agentId)
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
                            aiPaywallResponse = await venice.chatCompletion(fullSystemPrompt, history, userMessageWithInstruction, { apiKey: settings.venice_api_key, model: 'venice-uncensored' })
                        }

                        await whatsapp.markAsRead(contactPhone).catch(() => { })
                        await whatsapp.sendText(contactPhone, aiPaywallResponse, undefined, agentId)

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
                        const contactPhone = contact.phone_whatsapp || ''
                        const { phase, details, reason } = await director.determinePhase(contactPhone, agentId)
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
                            aiRefusal = await venice.chatCompletion(fullSystemPrompt, history, userMessageWithInstruction, { apiKey: settings.venice_api_key, model: 'venice-uncensored' })
                        }

                        await whatsapp.markAsRead(contactPhone).catch(() => { })
                        await whatsapp.sendText(contactPhone, aiRefusal, undefined, agentId)
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
                        const contactPhone = contact.phone_whatsapp || ''
                        const result = await mediaService.processRequest(contactPhone, analysis.intentCategory)

                        if (result.action === 'SEND') {
                            const dataUrl = result.media.url
                            await whatsapp.markAsRead(contactPhone).catch(() => { })

                            // Fix: Don't assume everything that isn't data:image is a video.
                            // Check extension or context match.
                            const isDataImage = dataUrl.startsWith('data:image')
                            const isVideoExt = dataUrl.match(/\.(mp4|mov|avi|webm|mkv)(\?|$)/i)
                            const isVideoIntent = analysis.intentCategory?.toLowerCase().includes('video')

                            const shouldSendAsVideo = !isDataImage && (isVideoExt || isVideoIntent)

                            if (shouldSendAsVideo) {
                                await whatsapp.sendVideo(contactPhone, dataUrl, undefined, agentId)
                            } else {
                                await whatsapp.sendImage(contactPhone, dataUrl, undefined, agentId)
                            }

                            await prisma.media.update({
                                where: { id: result.media.id },
                                data: { sentTo: { push: contactPhone } }
                            })

                            // Memory & Logs
                            const { memoryService } = require('@/lib/memory')
                            await memoryService.add(contactPhone, messageText)
                            await memoryService.add(contactPhone, `[System]: Sent media ${analysis.intentCategory}`)

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
                                    { apiKey: settings.venice_api_key, model: 'venice-uncensored' }
                                );
                            }

                            // Split & Send
                            const parts = responseText.split(/\|+/).filter(p => p.trim().length > 0)
                            const contactPhone = contact.phone_whatsapp || ''
                            for (const part of parts) {
                                await whatsapp.sendTypingState(contactPhone, true, agentId)
                                // Simulated Delay
                                await new Promise(r => setTimeout(r, 2000))
                                await whatsapp.markAsRead(contactPhone).catch(() => { })
                                await whatsapp.sendText(contactPhone, part.trim(), undefined, agentId)
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

        // --- CONTACT ACTIVATION ---
        // CRITICAL: Ensure contact is active when they send us a message
        // This handles cases where contact was created as 'unknown' but conversation exists
        if (contact.status === 'paused' || contact.status === 'new' || contact.status === 'unknown') {
            const oldStatus = contact.status
            try {
                contact = await prisma.contact.update({
                    where: { id: contact.id },
                    data: { status: 'active' }
                })
                console.log(`[Processor] Contact ${contact.id} activated (was: ${oldStatus})`)
            } catch (activateError) {
                console.error(`[Processor] Failed to activate contact ${contact.id}:`, activateError)
                // Continue with existing contact object
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

            // FIXED: Wake up conversation if it's paused and we received a message
            // This covers BOTH WAITING_FOR_LEAD (Smart Add) AND regular paused conversations
            if (conversation.status === 'paused') {
                const isWaitingForLead = meta?.state === 'WAITING_FOR_LEAD'

                console.log(`[Processor] Waking up conversation ${conversation.id} (Lead initiated contact, wasWaiting: ${isWaitingForLead})`)

                try {
                    conversation = await prisma.conversation.update({
                        where: { id: conversation.id },
                        data: {
                            status: 'active',
                            metadata: {
                                ...meta,
                                state: 'active', // clear waiting state
                                becameActiveAt: new Date(),
                                wokenBy: 'incoming_message'
                            }
                        },
                        include: { prompt: true }
                    })
                    console.log(`[Processor] ✅ Conversation ${conversation.id} successfully woken up. New status: ${conversation.status}`)
                } catch (wakeUpError) {
                    console.error(`[Processor] ❌ FAILED to wake up conversation ${conversation.id}:`, wakeUpError)
                    // Continue with old conversation object - handleChat will see 'paused' and return early
                }

                // Activate contact when conversation becomes active (lead is now engaged)
                if (contact.status === 'paused' || contact.status === 'new' || contact.status === 'unknown') {
                    try {
                        await prisma.contact.update({
                            where: { id: contact.id },
                            data: { status: 'active' }
                        })
                        console.log(`[Processor] Contact ${contact.id} marked as active`)
                    } catch (contactError) {
                        console.error(`[Processor] Failed to activate contact ${contact.id}:`, contactError)
                    }

                    // Update lead status to CONVERTED if it exists and is still IMPORTED
                    try {
                        const lead = await prisma.lead.findFirst({
                            where: {
                                contactId: contact.id,
                                status: 'IMPORTED'
                            }
                        })
                        if (lead) {
                            await prisma.lead.update({
                                where: { id: lead.id },
                                data: { status: 'CONVERTED', paidAt: new Date() }
                            })
                            console.log(`[Processor] Lead ${lead.id} marked as CONVERTED`)
                        }
                    } catch (leadError) {
                        console.error(`[Processor] Failed to update lead status for contact ${contact.id}:`, leadError)
                    }
                }
            }
        }

        console.log(`[Processor] Handing off to Chat Handler... Conversation status: ${conversation.status}`)
        const { handleChat } = require('@/lib/handlers/chat')

        // CONTEXT INJECTION: If this processor instance just generated a response (e.g. from Media Request or previous burst part),
        // we should pass it to handleChat so it doesn't repeat itself.
        // Currently, media request Logic returns early, so we only need to worry about BURST logic which handles this inside the CRON loop.
        // The CRON loop will pass `lastResponse` in `options`.

        // --- MEDIA HANDLING (Discord & WhatsApp) ---
        let mediaUrl: string | null = null

        // 1. Discord Attachments
        if (isDiscord && payload.attachments && payload.attachments.length > 0) {
            console.log(`[Processor] Processing ${payload.attachments.length} Discord attachments...`)
            const attachment = payload.attachments[0] // Verify: Handle multiple? For now handle first.
            const url = attachment.url
            if (url) {
                try {
                    console.log(`[Processor] Downloading Discord attachment: ${url}`)
                    const axios = require('axios')
                    const response = await axios.get(url, { responseType: 'arraybuffer' })
                    const buffer = Buffer.from(response.data)
                    const mime = attachment.content_type || 'image/jpeg'

                    const { storage } = require('@/lib/storage')
                    mediaUrl = await storage.uploadMedia(buffer, mime)
                    console.log(`[Processor] Discord attachment uploaded: ${mediaUrl}`)
                } catch (e) {
                    console.error('[Processor] Failed to process Discord attachment', e)
                }
            }
        }

        const chatResult = await handleChat(payload, contact, conversation, settings, messageText, agentId, platform, { ...options, mediaUrl }) // Pass mediaUrl in options

        console.log('[Processor] Chat Result:', chatResult)

        // ...

        // Queue processing is handled by CRON loop (every 10s)
        // Direct call removed to prevent race conditions and promise stacking
        if (chatResult?.result === 'queued') {
            console.log('[Processor] Message queued → CRON will process within ~10s')
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
