// lib/handlers/chat.ts
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { discord } from '@/lib/discord'
import { venice } from '@/lib/venice'
import { anthropic } from '@/lib/anthropic'
import { openrouter } from '@/lib/openrouter'
import { TimingManager } from '@/lib/timing'
import { logger } from '@/lib/logger'
import { formatResponse } from '@/lib/response-formatter'
// import { messageQueue } from '@/lib/queue' // Deprecated
import { NextResponse } from 'next/server'

// Platform-agnostic helper functions
function getSendText(platform: 'whatsapp' | 'discord') {
    return async (userId: string, text: string, replyTo?: string, agentId?: string) => {
        if (platform === 'discord') {
            return discord.sendText(userId, text, agentId)
        }
        return whatsapp.sendText(userId, text, replyTo, agentId)
    }
}

function getMarkAsRead(platform: 'whatsapp' | 'discord') {
    return async (userId: string, agentId?: string, messageKey?: any) => {
        if (platform === 'discord') {
            // Discord doesn't have a "mark as read" equivalent
            return Promise.resolve()
        }
        return whatsapp.markAsRead(userId, agentId, messageKey).catch(() => {})
    }
}



export async function handleChat(
    payload: any,
    contact: any,
    conversation: any,
    settings: any,
    messageTextInput: string, // The initial text (or transcribed voice from caller)
    agentId?: string, // Added: Agent Context
    platform: 'whatsapp' | 'discord' = 'whatsapp', // Added: Platform Context
    options?: { skipAI?: boolean } // Added: Burst Mode Support
) {
    let messageText = messageTextInput
    
    // Platform-specific helpers - defined as functions to avoid scope issues
    const sendTextPlatform = (platform === 'discord') 
        ? (userId: string, text: string, _replyTo?: string, agentId?: string) => discord.sendText(userId, text, agentId)
        : (userId: string, text: string, replyTo?: string, agentId?: string) => whatsapp.sendText(userId, text, replyTo, agentId)
    


    // ⛔ SELF-MESSAGE FILTER (Anti-Mirror)
    // When WhatsApp syncs history, it sends "upsert" events for messages WE sent.
    // We must IGNORE these, otherwise the bot talks to itself.
    if (payload.fromMe) {
        // Double check: if it's fromMe, it's definitely not a user message we need to reply to.
        // Unless we are debugging, this should be silently dropped.
        logger.info('Ignoring message from self (sync event)', { module: 'chat', id: payload.id })
        return { handled: true, result: 'ignored_from_me' }
    }

    // ⛔ OLD MESSAGE FILTER (Anti-Ban / Burst Protection)
    // If we receive a message that is > 60 seconds old, it means we are catching up on history (Sync).
    // Answering or even "Marking as Read" 50 old messages in 1 second triggers WhatsApp Spam filters.
    // ACTION: Ignore them completely and silently.
    const msgTimestamp = payload.timestamp ? new Date(payload.timestamp * 1000) : new Date()
    const ageInSeconds = (Date.now() - msgTimestamp.getTime()) / 1000

    if (ageInSeconds > 60) {
        logger.info(`Ignoring old message (${ageInSeconds.toFixed(1)}s old) - Sync Burst Protection`, { module: 'chat', id: payload.id })
        return { handled: true, result: 'ignored_old_sync' }
    }

    // 0. ADMIN VOICE VALIDATION INTERCEPTION
    // Check if the sender is the configured Voice Source (Admin)
    const adminPhone = settings.voice_source_number
    if (adminPhone && contact.phone_whatsapp === adminPhone) {
        const { voiceTtsService } = require('@/lib/voice-tts')
        // We pass the raw payload to get quotedMsg info
        const handled = await voiceTtsService.handleAdminValidation(messageText, payload)
        if (handled) {
            console.log('[Chat] Handled as Admin Voice Validation')
            return { handled: true, result: 'admin_validation' }
        }
    }

    // 1. View Once Handling
    const isViewOnce = payload._data?.isViewOnce === true || payload.isViewOnce === true
    if (isViewOnce) {
        logger.info('ViewOnce message rejected', { module: 'chat', contactId: contact.id })
        await new Promise(r => setTimeout(r, 2000))
        const refusalMsg = settings.msg_view_once_refusal || "Mince ça bug mon tel, j'arrive pas à ouvrir les photos éphémères (View Once) 😕\n\nTu peux me la renvoyer en normal stp ?"
        if (platform !== 'discord') await whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => {})
        await sendTextPlatform(contact.phone_whatsapp, refusalMsg, undefined, agentId)
        return { handled: true, result: 'view_once_rejected' }
    }

    // 2. Transcription (if not already done by caller, but caller handles heavy lifting usually. 
    // Actually, looking at route.ts, transcription logic WAS inline. 
    // Let's assume caller (route.ts) did the transcription to keep this handler pure "Chat/AI" logic?
    // OR, we move transcription here. Ideally here to keep route clean.
    // Let's move transcription here.

    const isVoiceMessage = payload.type === 'ptt' || payload.type === 'audio' || payload._data?.mimetype?.startsWith('audio')
    if (isVoiceMessage && !messageText.startsWith('[Voice Message -')) {
        logger.info('Chat: Audio Message Detected. Attempting transcription...', { module: 'chat', id: payload.id })
        try {
            const media = await whatsapp.downloadMedia(payload.id)
            if (media && media.data) {
                const { transcriptionService } = require('@/lib/transcription')

                // DATA TYPE FIX: media.data is already a Buffer from axios (responseType: arraybuffer)
                // Do NOT force base64 decoding on a buffer.
                const buffer = Buffer.isBuffer(media.data)
                    ? media.data
                    : Buffer.from(media.data as unknown as string, 'base64')

                // We now request WAV from Baileys, so use .wav extension
                const ext = 'audio.wav'

                const transcribedText = await transcriptionService.transcribe(buffer, ext)

                if (transcribedText) {
                    messageText = `[VOICE MESSAGE] ${transcribedText}` // Replace placeholder and Tag source
                    logger.info(`[Chat] Voice Transcribed: "${messageText}"`, { module: 'chat' })
                } else {
                    messageText = "[Voice Message - Transcription Failed]"
                    logger.warn('[Chat] Transcription returned null/empty', { module: 'chat' })
                }
            } else {
                logger.error(`[Chat] Download Failed for Media ID: ${payload.id}`, undefined, { module: 'chat' })
                messageText = "[Voice Message - Download Failed]"
            }
        } catch (e: any) {
            logger.error('Chat: Transcription Unexpected Error', e, { module: 'chat' })
            messageText = "[Voice Message - Error]"
        }
    }

    // 3. Vision Logic (OpenRouter Qwen2.5-VL)
    const isImageMessage = payload.type === 'image' || payload._data?.mimetype?.startsWith('image')
    if (isImageMessage && !messageText.includes('[Image Description]')) {
        console.log('[Chat] Image Detected. Analyzing with OpenRouter Vision...')
        console.log(`[Chat] OpenRouter API Key Present: ${settings.openrouter_api_key ? 'YES' : 'NO'}`)

        if (!settings.openrouter_api_key) {
            console.warn('[Chat] Vision skipped: No OpenRouter API key in settings')
        } else {
            try {
                const media = await whatsapp.downloadMedia(payload.id)
                console.log(`[Chat] Media downloaded: ${media ? 'YES' : 'NO'}, Data: ${media?.data ? 'YES' : 'NO'}`)

                if (media && media.data) {
                    // FIX: media.data is already a Buffer
                    const buffer = Buffer.isBuffer(media.data) ? media.data : Buffer.from(media.data as unknown as string, 'base64')
                    console.log(`[Chat] Buffer size: ${buffer.length} bytes`)

                    const description = await openrouter.describeImage(
                        buffer,
                        media.mimetype || 'image/jpeg',
                        settings.openrouter_api_key
                    )

                    if (description) {
                        messageText = messageText ? `${messageText}\n\n[Image Description]: ${description}` : `[Image Description]: ${description}`
                        console.log(`[Chat] Vision SUCCESS: ${description.substring(0, 100)}...`)
                    } else {
                        console.warn('[Chat] Vision returned null description')
                    }
                } else {
                    console.warn('[Chat] Vision skipped: No media data')
                }
            } catch (e: any) {
                console.error('[Chat] Vision FAILED:', e.message || e)
            }
        }
    }

    // 4. Save Contact Message
    let mediaUrl: string | null = null

    // Media Handling (Image/Video/Audio)
    if (payload.type === 'image' || payload.type === 'video' || payload.type === 'audio' || payload.type === 'ptt' || payload._data?.mimetype?.startsWith('image') || payload._data?.mimetype?.startsWith('video')) {
        console.log(`[Chat] Media detected (${payload.type}). Downloading & Uploading...`)
        try {
            const media = await whatsapp.downloadMedia(payload.id)
            if (media && media.data) {
                const { storage } = require('@/lib/storage')
                // FIX: media.data is already a Buffer
                const buffer = Buffer.isBuffer(media.data) ? media.data : Buffer.from(media.data as unknown as string, 'base64')
                const mime = media.mimetype || (payload.type === 'image' ? 'image/jpeg' : 'video/mp4')

                mediaUrl = await storage.uploadMedia(buffer, mime)
                if (mediaUrl) console.log(`[Chat] Media uploaded: ${mediaUrl}`)
                else console.warn('[Chat] Media upload failed')
            }
        } catch (e) {
            console.error('[Chat] Media handling failed:', e)
        }
    }

    // Media Handling ...

    console.log(`[Chat] Handling Message from ${contact.phone_whatsapp}. ID: ${payload.id}`)

    // ROBUST DEDUPLICATION DISABLED (User Request)
    // The user prefers to allow retries/duplicates rather than blocking valid messages that failed previously.
    /*
    const existingMsg = await prisma.message.findFirst({
        where: {
            OR: [
                { waha_message_id: payload.id }, // ID Match
                {
                    // Content Match (Fuzzy dedup for race conditions with diff IDs)
                    conversationId: conversation.id,
                    sender: 'contact',
                    message_text: messageText,
                    timestamp: { gt: new Date(Date.now() - 10000) } // 10s window
                }
            ]
        }
    })

    if (existingMsg) {
        console.warn(`[Chat] Duplicate message detected (ID: ${payload.id}, Existing: ${existingMsg.id}). Ignoring.`)
        return { handled: true, result: 'duplicate_found_early' }
    }
    */

    try {
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'contact',
                message_text: messageText,
                waha_message_id: payload.id,
                mediaUrl: mediaUrl,
                timestamp: new Date()
            }
        })
        
        // Update conversation tracking for inbox system
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt: new Date(),
                lastMessageSender: 'contact',
                unreadCount: { increment: 1 }
            }
        })

        // 🧠 IMMEDIATE MEMORY EXTRACTION (Fire & Forget)
        // Extract important facts from user message immediately for better context
        if (messageText && messageText.length > 10 && !messageText.startsWith('[')) {
            (async () => {
                try {
                    const { memoryExtractionService } = await import('@/lib/services/memory-extraction')
                    const { memoryService } = await import('@/lib/memory')
                    
                    // Quick extract from just this message
                    const facts = await memoryExtractionService.extractFacts(
                        `User: ${messageText}`,
                        settings
                    )
                    
                    if (facts.length > 0) {
                        const userId = memoryService.buildUserId(contact.phone_whatsapp, agentId || '')
                        await memoryService.addMany(userId, facts)
                        console.log(`[Chat] Immediate memory extraction: ${facts.length} facts stored`)
                    }
                } catch (e) {
                    // Silent fail - don't block conversation
                    console.warn('[Chat] Immediate memory extraction failed:', e)
                }
            })()
        }
    } catch (e: any) {
        if (e.code === 'P2002') return { handled: true, result: 'duplicate' }
        throw e
    }

    // PAYMENT DETECTION: DISABLED (Keyword-based detection removed)
    // Payments are now detected ONLY via the AI's [PAYMENT_RECEIVED] tag in the response.
    // This eliminates false positives from keyword matching (e.g., "fait tout de suite" triggering payments).
    // The AI has full conversation context and can make accurate determinations.
    // See line ~620 for AI tag detection.


    // BURST MODE: If we are processing a batch of messages, we might want to skip AI for all but the last one.
    // The message is already saved above, so context is preserved.
    if (options?.skipAI) {
        logger.info('Burst Mode: Skipping AI generation for message', { module: 'chat', contactId: contact.id, method: 'burst_skip' })
        return { handled: true, result: 'saved_skipped_ai' }
    }

    // 5. Checks (Paused/VoiceFail/ContactStatus)
    if (conversation.status === 'paused') {
        console.log('[Chat] Conversation is PAUSED. Ignoring message.')
        logger.info('Conversation paused', { module: 'chat', conversationId: conversation.id })
        return { handled: true, result: 'paused' }
    }
    
    // CRITICAL: Only respond if contact status is 'active'
    // Contact statuses: 'new', 'active', 'paused', 'unknown', 'archive', 'blacklisted', 'merged'
    // AI should only respond to 'active' contacts
    if (contact.status !== 'active') {
        console.log(`[Chat] Contact status is '${contact.status}', not 'active'. Ignoring message.`)
        logger.info('Contact not active', { module: 'chat', contactId: contact.id, status: contact.status })
        return { handled: true, result: 'contact_not_active' }
    }
    if (messageText.startsWith('[Voice Message -')) {
        // If transcription FAILED, we send refusal.
        // If it succeeded, messageText will be the actual text, so we skip this block.
        if (messageText.includes('Failed') || messageText.includes('Error') || messageText.includes('Disabled')) {
            const voiceRefusalMsg = settings.msg_voice_refusal || "Désolé, je ne peux pas écouter les messages vocaux pour le moment (Problème technique)."
            if (platform !== 'discord') await whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => {})
            await sendTextPlatform(contact.phone_whatsapp, voiceRefusalMsg, undefined, agentId)
            return { handled: true, result: 'voice_error' }
        }
    }

    if (!conversation.ai_enabled) {
        console.log('[Chat] AI is DISABLED for this conversation.')
        return { handled: true, result: 'ai_disabled' }
    }

    // CRITICAL: Block empty messages from triggering AI
    if (!messageText || messageText.trim() === '') {
        console.warn('[Chat] BLOCKING empty message - no content to process')
        return { handled: true, result: 'empty_message' }
    }

    // 6. Debounce
    if (!contact.testMode) {
        const DEBOUNCE_MS = 6000
        await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS))
        const newerMessage = await prisma.message.findFirst({
            where: {
                conversationId: conversation.id,
                sender: 'contact',
                timestamp: { gt: new Date(Date.now() - DEBOUNCE_MS + 500) },
                id: { gt: (await prisma.message.findFirst({ where: { waha_message_id: payload.id } }))?.id || 0 }
            }
        })
        if (newerMessage) return { handled: true, result: 'debounced' }

        // Background Profiler - Always run but with deduplication via lastProfileUpdate
        const shouldProfile = !contact.lastProfileUpdate || 
            (new Date().getTime() - new Date(contact.lastProfileUpdate).getTime()) > 30 * 60 * 1000 // 30 min minimum
        
        if (shouldProfile) {
            const { profilerService } = require('@/lib/profiler')
            profilerService.updateProfile(contact.id)
                .then(() => {
                    // Update timestamp to prevent re-running too soon
                    prisma.contact.update({
                        where: { id: contact.id },
                        data: { lastProfileUpdate: new Date() }
                    }).catch(() => {}) // Silent fail
                })
                .catch(console.error)
        }
    }

    // 7. Spinlock
    await acquireLock(conversation.id)

    try {
        // AI GENERATION LOGIC
        // Pass options (containing previousResponse) to the generator
        const result = await generateAndSendAI(conversation, contact, settings, messageText, payload, agentId, platform, options, undefined)

        // 8. Payment Claim Detection: MOVED to Tag-Based in generateAndSendAI
        // We no longer scan user text. We listen for [PAYMENT_RECEIVED] from AI.

        return result
    } catch (error: any) {
        // CRITICAL: Handle Venice API errors gracefully
        if (error.message?.includes('VENICE_API_REJECTED') || error.message?.includes('402') || error.message?.includes('Insufficient balance')) {
            console.error('[Chat] 🚨 Venice API error in handleChat:', error.message)
            // Return handled to prevent processor crash
            return { handled: true, result: 'ai_quota_failed', error: error.message }
        }
        // Re-throw other errors
        throw error
    } finally {
        await releaseLock(conversation.id)
    }
}

// --- HELPERS ---

async function acquireLock(convId: number) {
    const LOCK_TIMEOUT = 30000
    let isLocked = true
    let retries = 0
    while (isLocked && retries < 15) {
        const c = await prisma.conversation.findUnique({ where: { id: convId } })
        if (!c?.processingLock || new Date().getTime() - c.processingLock.getTime() > LOCK_TIMEOUT) isLocked = false
        else {
            await new Promise(r => setTimeout(r, 1000))
            retries++
        }
    }
    await prisma.conversation.update({ where: { id: convId }, data: { processingLock: new Date() } })
}

async function releaseLock(convId: number) {
    await prisma.conversation.update({ where: { id: convId }, data: { processingLock: null } })
}

/**
 * Validation bloquante avec régénération si nécessaire
 * Factorisée pour être utilisée aussi bien pour les messages instantanés que les messages en queue
 */
async function generateAndSendAI(conversation: any, contact: any, settings: any, lastMessageText: string, payload: any, agentId?: string, platform: 'whatsapp' | 'discord' = 'whatsapp', options?: any, preloadedProfile?: any) {
    // 1. Fetch History
    const historyDesc = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { timestamp: 'desc' },
        take: 50
    })
    const history = historyDesc.reverse()

    // Dedupe
    const uniqueHistory: any[] = []
    if (history.length > 0) uniqueHistory.push(history[0])
    for (let i = 1; i < history.length; i++) {
        const prev = uniqueHistory[uniqueHistory.length - 1]
        const curr = history[i]
        if (prev.sender !== curr.sender || prev.message_text.trim() !== curr.message_text.trim()) uniqueHistory.push(curr)
    }

    // CONTEXT INJECTION: Append the in-memory previous response if available (from Burst/Media logic)
    if (options?.previousResponse) {
        console.log('[Chat] Injecting previous in-memory response into context to prevent repetition.')
        uniqueHistory.push({
            sender: 'ai',
            message_text: options.previousResponse,
            timestamp: new Date() // Fake timestamp
        })
    }

    // 1.5 Fetch Media Contexts
    const mediaUrls = uniqueHistory
        .filter((m: any) => m.mediaUrl && m.mediaUrl.length > 0)
        .map((m: any) => m.mediaUrl)

    let mediaContextMap: Record<string, string> = {}
    if (mediaUrls.length > 0) {
        try {
            const medias = await prisma.media.findMany({
                where: { url: { in: mediaUrls } },
                select: { url: true, context: true }
            })
            medias.forEach((m: any) => {
                if (m.context) mediaContextMap[m.url] = m.context
            })
        } catch (e) {
            console.error('Failed to fetch media contexts', e)
        }
    }

    const messagesForAI = uniqueHistory.map((m: any) => {
        let content = m.message_text
        if (m.mediaUrl && mediaContextMap[m.mediaUrl]) {
            content += `\n\n[SYSTEM NOTE - IMAGE CONTEXT]: The user can see the image you sent. Secret Context: "${mediaContextMap[m.mediaUrl]}"`
        }
        return {
            role: m.sender === 'contact' ? 'user' : 'ai',
            content: content
        }
    })
    
    // Find the last user message (from contact) to use as lastContent
    // Admin messages are mapped to 'ai' role, so they stay in context
    let lastUserMessageIndex = -1
    for (let i = messagesForAI.length - 1; i >= 0; i--) {
        if (messagesForAI[i].role === 'user') {
            lastUserMessageIndex = i
            break
        }
    }
    
    let contextMessages: typeof messagesForAI
    let lastContent: string
    
    if (lastUserMessageIndex >= 0) {
        // Remove the last user message from context and use it as lastContent
        contextMessages = messagesForAI.filter((_, i) => i !== lastUserMessageIndex)
        lastContent = messagesForAI[lastUserMessageIndex].content
    } else {
        // Fallback: no user message found, use old logic
        contextMessages = messagesForAI.slice(0, -1)
        lastContent = messagesForAI[messagesForAI.length - 1]?.content || lastMessageText
    }

    // 2. Director (for signal analysis and phase)
    const { director } = require('@/lib/director')

    // Check for Trust Analysis Trigger
    // Trigger every 5 messages OR if > 6 hours since last analysis
    // 🔥 OPTIMISATION: Fréquence augmentée pour meilleure réactivité
    const MSG_INTERVAL = 5;
    const TIME_INTERVAL = 6 * 60 * 60 * 1000;

    let shouldAnalyze = false;
    if (!contact.lastTrustAnalysis) shouldAnalyze = true;
    else {
        const timeDiff = new Date().getTime() - new Date(contact.lastTrustAnalysis).getTime();
        if (timeDiff > TIME_INTERVAL) shouldAnalyze = true;
        else {
            // Count messages since last analysis
            const recentCount = await prisma.message.count({
                where: {
                    conversationId: conversation.id,
                    timestamp: { gt: contact.lastTrustAnalysis }
                }
            });
            if (recentCount >= MSG_INTERVAL) shouldAnalyze = true;
        }
    }

    const effectiveAgentId = agentId || conversation?.agentId || '1' // Fallback if absolutely missing

    if (shouldAnalyze) {
        console.log(`[Chat] Triggering Signal Analysis for ${contact.phone_whatsapp}...`);
        // FIXED: Now correctly passing agentId and using performSignalAnalysis
        director.performSignalAnalysis(contact.phone_whatsapp, effectiveAgentId).catch(console.error);
    }

    // 🔥 SWARM-ONLY: Director.buildSystemPrompt archived, using SWARM orchestration
    const { phase } = await director.determinePhase(contact.phone_whatsapp, effectiveAgentId)
    console.log(`[Chat] SWARM-ONLY mode - Phase: ${phase} (Director legacy archived)`)

    // 3. Timing & Agent Profile (pour Swarm aussi)
    logger.info('Generating AI response', { module: 'chat', conversationId: conversation.id, phase })
    const lastUserDate = new Date() // Approx

    // Fetch Agent Profile complet (utilisé pour timing et passé au Swarm pour éviter re-requête)
    let agentTimezone = 'Europe/Paris' // Default safe fallback
    let agentLocale = 'en-US' // Default
    let agentProfilePreloaded = null
    
    if (effectiveAgentId) {
        try {
            agentProfilePreloaded = await prisma.agentProfile.findUnique({
                where: { agentId: effectiveAgentId },
                select: {
                    contextTemplate: true,
                    styleRules: true,
                    identityTemplate: true,
                    phaseConnectionTemplate: true,
                    phaseVulnerabilityTemplate: true,
                    phaseCrisisTemplate: true,
                    phaseMoneypotTemplate: true,
                    paymentRules: true,
                    safetyRules: true,
                    timezone: true,
                    locale: true,
                    baseAge: true,
                    bankAccountNumber: true,
                    bankRoutingNumber: true
                }
            })
            if (agentProfilePreloaded?.timezone) agentTimezone = agentProfilePreloaded.timezone
            if (agentProfilePreloaded?.locale) agentLocale = agentProfilePreloaded.locale
        } catch (e) {
            console.warn('[Chat] Failed to fetch agent profile, using default:', e)
        }
    }

    // Check for High Priority Keywords (for timing adjustment only)
    // Payment detection is now handled earlier (after message save)
    const moneyKeywords = ['money', 'pay', 'paypal', 'cashapp', 'venmo', 'zelle', 'transfer', 'cash', 'dollars', 'usd', '$', 'price', 'cost', 'bank', 'card', 'crypto', 'bitcoin', 'sent', 'paid', 'done', 'envoyé', 'payé', 'viré', 'transfered', 'just sent', 'sending']
    const isHighPriority = moneyKeywords.some(kw => lastContent.toLowerCase().includes(kw))

    let timing = TimingManager.analyzeContext(lastUserDate, phase, isHighPriority, agentTimezone)

    // Debug logging
    console.log(`[Timing] Agent Timezone: ${agentTimezone}`)
    console.log(`[Timing] Contact testMode: ${contact.testMode}`)
    console.log(`[Timing] Before override - Mode: ${timing.mode}, Delay: ${timing.delaySeconds}s`)

    // TEST MODE: Override ALL timing, respond in 3-8 seconds
    if (contact.testMode === true) {
        timing = {
            mode: 'INSTANT_TEST' as any,
            delaySeconds: Math.floor(Math.random() * 5) + 3, // 3-8 seconds
            shouldGhost: true
        }
        console.log(`[Timing] TEST MODE ACTIVE - Overriding to ${timing.delaySeconds}s`)
    }

    console.log(`[Timing] Final - Mode: ${timing.mode}, Delay: ${timing.delaySeconds}s`)

    // 🔥 SWARM-ONLY: Life context is handled by timingNode in swarm
    
    // QUEUE AWARENESS: Let AI see pending messages and decide to cancel if needed
    const pendingQueueItems = await prisma.messageQueue.findMany({
        where: {
            conversationId: conversation.id,
            status: 'PENDING'
        },
        orderBy: { scheduledAt: 'asc' }
    })

    let queuePrompt = ""
    if (pendingQueueItems.length > 0) {
        const queueContext = pendingQueueItems.map((item: any) => {
            const type = item.mediaUrl ? (item.mediaUrl.includes('audio') ? 'Voice' : 'Media') : 'Text'
            const preview = item.content?.substring(0, 60) || '[No content]'
            const time = item.scheduledAt ? new Date(item.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'now'
            return `- ID:${item.id} (${type}, ${time}): "${preview}${item.content?.length > 60 ? '...' : ''}"`
        }).join('\n')

        const locale = agentLocale.startsWith('fr') ? 'fr' : 'en'
        queuePrompt = locale === 'fr'
            ? `\n\n[INTERFACE SYSTÈME]\nMESSAGES EN ATTENTE:\n${queueContext}\n\nCOMMANDES:\n- [CANCEL:ID] : Annule le message ID (ne sera pas envoyé).\n\nINSTRUCTION: Si le nouveau message rend un message en attente obsolète, répétitif ou incohérent, tu DOIS utiliser la commande [CANCEL:ID] au début de ta réponse.\n⚠️ RÈGLE: N'annule PAS si le nouveau message est court ou neutre (ex: "ok", "lol", emoji). Annule seulement s'il y a une vraie contradiction.\nExemple: [CANCEL:42] Bonne nuit !`
            : `\n\n[SYSTEM INTERFACE]\nPENDING MESSAGES:\n${queueContext}\n\nCOMMANDS:\n- [CANCEL:ID] : Cancels message ID (will not be sent).\n\nINSTRUCTION: If the new message makes a pending message obsolete, redundant, or incoherent, you MUST use the [CANCEL:ID] command at the start of your response.\n⚠️ RULE: DO NOT cancel if the new message is short or neutral (e.g., "ok", "lol", emoji). Cancel only if there is a real contradiction.\nExample: [CANCEL:42] Goodnight!`

        console.log(`[Chat] Prepared Queue Context for injection: ${pendingQueueItems.length} items`)
    }

    // Queue if delay > 10s (reduced from 22s to avoid CRON 504 timeouts)
    // CRON has ~30s timeout, AI call takes ~10-15s, so any delay > 10s risks timeout
    if (timing.delaySeconds > 10) {
        // If there are already pending messages for this conversation,
        // schedule this one right after the last one (with small delay)
        // instead of spacing them by 30+ minutes
        let scheduledAt: Date
        
        if (pendingQueueItems.length > 0) {
            // Find the latest scheduled message
            const lastScheduled = pendingQueueItems.reduce((latest, item) => 
                item.scheduledAt > latest.scheduledAt ? item : latest
            , pendingQueueItems[0])
            
            // Schedule 10-20 seconds after the last one (natural burst)
            const burstDelay = 10000 + Math.random() * 10000
            scheduledAt = new Date(lastScheduled.scheduledAt.getTime() + burstDelay)
            console.log(`[Chat] Scheduling message after existing queue item. Last: ${lastScheduled.scheduledAt.toISOString()}, New: ${scheduledAt.toISOString()}`)
        } else {
            // No existing queue items, use normal delay
            const effectiveDelay = Math.max(timing.delaySeconds, 60)
            scheduledAt = new Date(Date.now() + effectiveDelay * 1000)
        }

        // Generate NOW (SWARM mode - system prompt handled by swarm)
        let responseText = await callAI(settings, conversation, queuePrompt || '', contextMessages, lastContent, contact, agentId, platform, agentProfilePreloaded)

        // ═══════════════════════════════════════════════════════════════════════════
        // SUPERVISOR BLOQUANT pour messages en QUEUE aussi
        // ═══════════════════════════════════════════════════════════════════════════
        let queueValidationAttempts = 0;
        const MAX_QUEUE_VALIDATION_RETRIES = 2;
        
        while (queueValidationAttempts < MAX_QUEUE_VALIDATION_RETRIES) {
            try {
                const { supervisorOrchestrator } = require('@/lib/services/supervisor')

                const supervisorContext = {
                    agentId: effectiveAgentId,
                    conversationId: conversation.id,
                    contactId: contact.id,
                    userMessage: lastContent,
                    aiResponse: responseText,
                    history: contextMessages.map((m: any) => ({
                        role: m.role === 'user' ? 'user' as const : 'ai' as const,
                        content: m.content
                    })),
                    phase: phase,
                    pendingQueue: pendingQueueItems.map((item: any) => ({
                        id: item.id,
                        content: item.content,
                        scheduledAt: item.scheduledAt.toISOString()
                    }))
                }

                const validation = await supervisorOrchestrator.validateBlocking(supervisorContext);
                
                if (!validation.isValid && validation.shouldRegenerate) {
                    queueValidationAttempts++;
                    console.warn(`[Chat][Queue] Supervisor rejected response (${validation.severity}):`, validation.issues);
                    
                    if (queueValidationAttempts < MAX_QUEUE_VALIDATION_RETRIES) {
                        console.log(`[Chat][Queue] Regenerating response... (attempt ${queueValidationAttempts + 1})`);
                        
                        const errorContext = `\n\n⚠️ CORRECTION NÉCESSAIRE: Évite absolument ces erreurs: ${validation.issues.join('; ')}`;
                        
                        responseText = await callAI(
                            settings, 
                            conversation, 
                            (queuePrompt || '') + errorContext, 
                            contextMessages, 
                            lastContent, 
                            contact, 
                            agentId, 
                            platform, 
                            agentProfilePreloaded
                        );
                        
                        responseText = responseText
                            .replace(/\*\*[^*]*\*\*/g, '')
                            .replace(/\*[^*]*\*/g, '')
                            .replace(/```/g, '')
                            .replace(/^\*+/g, '')
                            .replace(/\*+$/g, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                        
                        continue;
                    } else {
                        console.error('[Chat][Queue] Max validation retries reached, using fallback response');
                        responseText = "jsuis là, tkt";
                        break;
                    }
                } else if (!validation.isValid) {
                    console.warn('[Chat][Queue] Supervisor found issues but no regeneration needed:', validation.issues);
                } else {
                    console.log('[Chat][Queue] Supervisor validation passed');
                }
                
                break;
                
            } catch (supervisorError) {
                console.error('[Chat][Queue] Supervisor validation failed:', supervisorError);
                break;
            }
        }
        // ═══════════════════════════════════════════════════════════════════════════

        await prisma.messageQueue.create({
            data: {
                contactId: contact.id,
                conversationId: conversation.id,
                content: responseText,
                scheduledAt: scheduledAt,
                status: 'PENDING'
            }
        })
        if (timing.shouldGhost) {
            // @ts-ignore - Platform helper scope issue
            if (platform !== 'discord') await whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => {})
        }
        return { handled: true, result: 'queued', scheduledAt }
    }

    // 4. Inline Wait
    logger.info('Waiting before AI response', { module: 'chat', delaySeconds: timing.delaySeconds, mode: timing.mode })
    if (timing.delaySeconds > 0) await new Promise(r => setTimeout(r, timing.delaySeconds * 1000))

    // 5. Generate with Retry Limit
    let attempts = 0
    const MAX_RETRIES = 2
    let responseText = ""

    while (attempts < MAX_RETRIES) {
        attempts++
        
        // SWARM mode: retry logic handled within runSwarm, no manual system prompt needed
        if (attempts > 1) {
            logger.info('AI retry due to empty response', { module: 'chat', attempt: attempts, conversationId: conversation.id })
        }

        try {
            // SWARM mode: system prompt constructed by swarm, we just pass queue context
            const swarmContext = (queuePrompt || '') + (attempts > 1 ? 
                (settings.prompt_ai_retry_logic || "\n\n[SYSTEM CRITICAL]: Your previous response was valid actions like *nods* but contained NO spoken text. You MUST write spoken text now. Do not just act. Say something.") 
                : '')
            responseText = await callAI(settings, conversation, swarmContext || null, contextMessages, lastContent, contact, effectiveAgentId, platform, agentProfilePreloaded)
        } catch (error: any) {
            console.error(`[Chat] AI Attempt ${attempts} failed:`, error.message)

            // CRITICAL: Handle Async Job Handoff
            if ((error as any).isAsyncJob || error.message?.startsWith('RUNPOD_ASYNC_JOB')) {
                const jobId = (error as any).jobId || error.message.split(':')[1]
                console.log(`[Chat] Async Job Started: ${jobId}. Stopping sync execution.`)
                return { handled: true, result: 'async_job_started', jobId }
            }

            // CRITICAL: Handle Venice API Rejection (402)
            if (error.message?.includes('VENICE_API_REJECTED') || error.message?.includes('402') || error.message?.includes('Insufficient balance')) {
                console.error('[Chat] 🚨 VENICE API REJECTED! Check your credits/API key.')
                
                // Log to credit monitor
                const { creditMonitor } = require('@/lib/services/credit-monitor')
                creditMonitor.addAlert({
                    provider: 'venice',
                    status: 'depleted',
                    message: `Venice AI rejected request: ${error.message}. Recharge credits at https://venice.ai/settings/billing`,
                    agentId: effectiveAgentId
                })
                
                // Queue for retry later instead of failing completely
                await prisma.messageQueue.create({
                    data: {
                        contactId: contact.id,
                        conversationId: conversation.id,
                        content: `[SYSTEM: AI GENERATION FAILED - Will Retry]\nReason: Insufficient Credits (402)\nOriginal User Message: "${lastContent}"`,
                        status: 'AI_FAILED_402',
                        scheduledAt: new Date(Date.now() + 5 * 60 * 1000) // Retry in 5 minutes
                    }
                })
                return { handled: true, result: 'ai_quota_failed_queued_for_retry' }
            }

            // If it's a temporary error, we let the loop retry (up to MAX_RETRIES)
            if (attempts >= MAX_RETRIES) throw error
        }

        // Valid response found?
        if (responseText && responseText.trim().length > 0) break
    }

    console.log(`[Chat] AI Response (raw): "${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}"`)

    // QUEUE AWARENESS: Parse and execute CANCEL commands from AI response
    // FIX: Accept UUIDs (alphanumeric + hyphens), not just digits
    const cancelMatches = responseText.matchAll(/\[CANCEL:\s*([a-zA-Z0-9-]+)\]/gi)
    const cancelledIds: string[] = []
    for (const match of cancelMatches) {
        const queueId = match[1]
        if (queueId) {
            cancelledIds.push(queueId)
        }
    }

    if (cancelledIds.length > 0) {
        console.log(`[Chat] AI decided to cancel queue items: ${cancelledIds.join(', ')}`)
        await prisma.messageQueue.updateMany({
            where: {
                id: { in: cancelledIds },
                conversationId: conversation.id,
                status: 'PENDING'
            },
            data: { status: 'CANCELLED_BY_AI' }
        })
        // Remove CANCEL tokens from the final response (FIX: accept UUIDs)
        responseText = responseText.replace(/\[CANCEL:[a-zA-Z0-9-]+\]/gi, '').trim()
        console.log(`[Chat] Cleaned response: "${responseText.substring(0, 80)}..."`)
    }
    // 5.5. AI-POWERED MESSAGE VALIDATION & CLEANING
    // Use dedicated AI agent to clean formatting, validate timing, split long messages
    
    // 🚨 CRITICAL: Extract and preserve functional tags before validation
    // The validator sometimes strips [IMAGE:...] tags incorrectly
    const imageTagRegexPreserver = /\[IMAGE:[^\]]+\]/gi
    const preservedImageTags = responseText.match(imageTagRegexPreserver) || []
    console.log(`[Chat] Preserving ${preservedImageTags.length} image tag(s):`, preservedImageTags)
    
    try {
        const { messageValidator } = require('@/lib/services/message-validator')

        // Transform conversation history for validator
        const validatorHistory = contextMessages.map((m: any) => ({
            sender: m.role === 'user' ? 'user' as const : 'ai' as const,
            text: m.content
        }))

        // Run AI validator (pass Venice API key from settings)
        // CRITICAL: NEVER validate Voice messages (the validator destroys them/splits them)
        let cleanedMessage = responseText

        if (responseText.trim().startsWith('[VOICE]')) {
            logger.info('Skipping Message Validator for [VOICE] message', { module: 'chat' })
        } else {
            cleanedMessage = await messageValidator.validateAndClean(
                responseText,
                validatorHistory,
                lastContent,
                settings.venice_api_key,
                agentLocale
            )
        }

        // Update responseText with cleaned version
        if (cleanedMessage && cleanedMessage !== responseText) {
            console.log(`[Chat] ✅ Message cleaned by AI validator`)
            responseText = cleanedMessage
        }
    } catch (validatorError: any) {
        console.warn('[Chat] Validator failed, using mechanical fallback:', validatorError.message)
        // Fallback to mechanical cleaning
        const { messageValidator } = require('@/lib/services/message-validator')
        responseText = messageValidator.mechanicalClean(responseText, lastContent)
    }
    
    // 🚨 RESTORE preserved tags if they were stripped
    if (preservedImageTags.length > 0) {
        const hasImageTag = imageTagRegexPreserver.test(responseText)
        if (!hasImageTag) {
            // Tags were stripped - restore them
            console.log(`[Chat] 🚨 Validator stripped image tags! Restoring:`, preservedImageTags)
            // Insert at beginning of message (or end, depending on preference)
            responseText = preservedImageTags.join(' ') + ' ' + responseText
        }
    }

    // 🚨 LAST-RESORT SAFETY: Strip ANY SYSTEM blocks that might have leaked through 🚨
    // This catches AI chain-of-thought commentary like "(SYSTEM: This response maintains...)"
    const beforeSanitize = responseText
    responseText = responseText.replace(/\(SYSTEM:\s*[^)]*\)/gi, '')
    responseText = responseText.replace(/\[SYSTEM:\s*[^\]]*\]/gi, '')
    responseText = responseText.replace(/\(Note:\s*[^)]*\)/gi, '')
    responseText = responseText.replace(/\(This response[^)]*\)/gi, '')
    responseText = responseText.trim()
    if (responseText !== beforeSanitize) {
        console.warn('[Chat] 🚨 SYSTEM LEAK DETECTED AND REMOVED! This should not happen.')
        logger.error('SYSTEM block leaked through validator', new Error('SYSTEM_LEAK'), {
            module: 'chat',
            before: beforeSanitize.substring(0, 200)
        })
    }

    // 🧹 AGGRESSIVE CLEANUP: Remove formatting artifacts like "**********", "```", "**"
    const { messageValidator } = require('@/lib/services/message-validator')
    const beforeCleanup = responseText
    responseText = messageValidator.aggressiveArtifactCleanup(responseText)
    if (responseText !== beforeCleanup) {
        console.warn(`[Chat] 🧹 Cleaned formatting artifacts: "${beforeCleanup}" -> "${responseText}"`)
    }

    // 🚨 BLOCK EMPTY/FORMATTING-ONLY MESSAGES 🚨
    // Prevents sending "**", "** **", """" etc. (formatting artifacts)
    if (messageValidator.isEmptyOrOnlyFormatting(responseText)) {
        console.warn(`[Chat] BLOCKING message with only formatting artifacts: "${responseText}"`)
        logger.warn('Message blocked - only formatting artifacts', { 
            module: 'chat', 
            responseText,
            conversationId: conversation.id 
        })
        return { handled: true, result: 'blocked_formatting_only' }
    }

    // 5.8. TAG STRIPPING (EARLY) - Before Supervisor sees it
    // We strip [IMAGE:...] tags now so they don't appear in Supervisor Dashboard or User Chat.
    const imageKeywords: string[] = []
    const imageTagRegex = /\[IMAGE:(.+?)\]/g
    let imgMatch
    // Extract all keywords
    while ((imgMatch = imageTagRegex.exec(responseText)) !== null) {
        imageKeywords.push(imgMatch[1].trim())
    }
    // Remove all tags globally
    responseText = responseText.replace(imageTagRegex, '').trim()

    console.log(`[Chat] AI Response (final cleaned): "${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}"`)

    // ═══════════════════════════════════════════════════════════════════════════
    // SUPERVISOR AI - BLOQUANT: Valide avant envoi, régénère si nécessaire
    // ═══════════════════════════════════════════════════════════════════════════
    let inlineValidationAttempts = 0;
    const MAX_INLINE_VALIDATION_RETRIES = 2;
    
    while (inlineValidationAttempts < MAX_INLINE_VALIDATION_RETRIES) {
        try {
            const { supervisorOrchestrator } = require('@/lib/services/supervisor')

            const supervisorContext = {
                agentId: effectiveAgentId,
                conversationId: conversation.id,
                contactId: contact.id,
                userMessage: lastContent,
                aiResponse: responseText,
                history: contextMessages.map((m: any) => ({
                    role: m.role === 'user' ? 'user' as const : 'ai' as const,
                    content: m.content
                })),
                phase: phase,
                pendingQueue: pendingQueueItems.map((item: any) => ({
                    id: item.id,
                    content: item.content,
                    scheduledAt: item.scheduledAt.toISOString()
                }))
            }

            const validation = await supervisorOrchestrator.validateBlocking(supervisorContext);
            
            if (!validation.isValid && validation.shouldRegenerate) {
                inlineValidationAttempts++;
                console.warn(`[Chat] Supervisor rejected response (${validation.severity}):`, validation.issues);
                
                if (inlineValidationAttempts < MAX_INLINE_VALIDATION_RETRIES) {
                    console.log(`[Chat] Regenerating response... (attempt ${inlineValidationAttempts + 1})`);
                    
                    const errorContext = `\n\n⚠️ CORRECTION NÉCESSAIRE: Évite absolument ces erreurs: ${validation.issues.join('; ')}`;
                    
                    responseText = await callAI(
                        settings, 
                        conversation, 
                        (queuePrompt || '') + errorContext, 
                        contextMessages, 
                        lastContent, 
                        contact, 
                        effectiveAgentId, 
                        platform, 
                        preloadedProfile
                    );
                    
                    responseText = responseText
                        .replace(/\*\*[^*]*\*\*/g, '')
                        .replace(/\*[^*]*\*/g, '')
                        .replace(/```/g, '')
                        .replace(/^\*+/g, '')
                        .replace(/\*+$/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    
                    continue;
                } else {
                    console.error('[Chat] Max validation retries reached, using fallback response');
                    responseText = "jsuis là, tkt";
                    break;
                }
            } else if (!validation.isValid) {
                console.warn('[Chat] Supervisor found issues but no regeneration needed:', validation.issues);
            } else {
                console.log('[Chat] Supervisor validation passed');
            }
            
            break;
            
        } catch (supervisorError) {
            console.error('[Chat] Supervisor validation failed:', supervisorError);
            break;
        }
    }
    // ═══════════════════════════════════════════════════════════════════════════

    // 6. Notification Trigger (Internal Tags)
    // PAYMENT DETECTION: Now ONLY via AI tag (keyword detection removed to avoid false positives)
    
    // 6a. PAYMENT VERIFICATION REQUEST: User asks if we received the payment
    // AI uses [VERIFY_PAYMENT] tag to indicate she's going to check
    if (responseText.includes('[VERIFY_PAYMENT]') || responseText.includes('[VERIFIER_PAIEMENT]')) {
        console.log('[Chat] Tag [VERIFY_PAYMENT] detected. Notifying admin for verification...')
        responseText = responseText.replace(/\[VERIFY_PAYMENT\]|\[VERIFIER_PAIEMENT\]/g, '').trim()
        
        try {
            const { notifyPaymentClaim } = require('@/lib/services/payment-claim-handler')
            await notifyPaymentClaim(contact, conversation, settings, null, null, agentId, 'verification_request')
            console.log('[Chat] Payment verification notification sent to admin.')
        } catch (e) {
            console.error('[Chat] Failed to send verification notification', e)
        }
    }
    
    // 6b. PAYMENT CONFIRMATION: User confirms they sent money
    // AI uses [PAYMENT_RECEIVED] tag
    if (responseText.includes('[PAYMENT_RECEIVED]') || responseText.includes('[PAIEMENT_REÇU]') || responseText.includes('[PAIEMENT_RECU]')) {
        console.log('[Chat] Tag [PAYMENT_RECEIVED] detected. Triggering notification...')
        responseText = responseText.replace(/\[PAYMENT_RECEIVED\]|\[PAIEMENT_REÇU\]|\[PAIEMENT_RECU\]/g, '').trim()

        try {
            const { notifyPaymentClaim } = require('@/lib/services/payment-claim-handler')
            await notifyPaymentClaim(contact, conversation, settings, null, null, agentId, 'claim')
            console.log('[Chat] Payment claim notification sent from AI tag.')
            
            // 🔥 NOUVEAU: Résoudre la story active
            const { storyManager } = require('@/lib/engine')
            const activeStory = await storyManager.getActiveStory(contact.id, agentId)
            if (activeStory && activeStory.amount) {
                await storyManager.resolveStory(activeStory.id, contact.id, agentId || '')
                console.log(`[Chat] Story ${activeStory.description} marked as RESOLVED`)
            }
        } catch (e) {
            console.error('[Chat] Failed to trigger notification or resolve story', e)
        }
    }

    // Safety: Final Check (If still empty after retries/stripping, abort)
    if ((!responseText || responseText.trim().length === 0) && imageKeywords.length === 0) {
        console.warn(`[Chat] AI returned empty response after ${attempts} attempts for Conv ${conversation.id}. Aborting send.`)
        return { handled: true, result: 'ai_response_empty' }
    }
    if (responseText.includes('Error:') || responseText.includes('undefined')) return { handled: true, result: 'blocked_safety' }

    // Reaction Logic ([REACT:emoji])
    const reactionMatch = responseText.match(/\[REACT:(.+?)\]/)
    if (reactionMatch) {
        const emoji = reactionMatch[1].trim()
        responseText = responseText.replace(reactionMatch[0], '').trim()

        // Send reaction immediately
        if (platform !== 'discord') await whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => {})
        whatsapp.sendReaction(contact.phone_whatsapp, payload.id, emoji, agentId)
            .catch(err => console.error('[Chat] Failed to send reaction:', err))

        console.log(`[Chat] AI sent reaction: ${emoji}`)
    }

    // Payment tag detection removed - payments are now detected directly from user messages
    // before AI generation (see line 184-197)


    // Image Logic ([IMAGE:keyword]) - Processed from extracted keywords
    if (imageKeywords.length > 0) {
        const keyword = imageKeywords[0];
        console.log(`[Chat] AI wanted to send ${imageKeywords.length} image(s). Check availability for: ${keyword}`)

        const { mediaService } = require('@/lib/media'); // Lazy import

        // Synchronously check availability (AWAITED)
        let typeId = await mediaService.findMediaTypeByKeyword(keyword)
        if (!typeId) {
            console.log(`[Chat] Image keyword "${keyword}" not found directly. Using as raw typeId.`)
            typeId = keyword
        }

        const mediaResult = await mediaService.processRequest(contact.phone_whatsapp, typeId)

        if (mediaResult.action === 'SEND' && mediaResult.media) {
            console.log(`[Chat] ✅ Media available for "${typeId}". Sending image + original text.`)

                // EXECUTE ASYNC SEND (Fire & Forget to strictly unblock queues, but handled internally)
                ; (async () => {
                    try {
                        const result = mediaResult // reuse
                        // 1. Send Image
                        let dataUrl = result.media.data
                        if (dataUrl && !dataUrl.startsWith('http') && !dataUrl.startsWith('data:')) {
                            dataUrl = `data:${result.media.mimeType || 'image/jpeg'};base64,${dataUrl}`
                        }

                        if (platform !== 'discord') await whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => {})

                        // Smart Send: Check if it's actually a video
                        const isVideo = (result.media.mimeType && result.media.mimeType.startsWith('video')) ||
                            (dataUrl.match(/\.(mp4|mov|avi|webm|mkv)(\?|$)/i));

                        if (isVideo) {
                            await whatsapp.sendVideo(contact.phone_whatsapp, dataUrl, result.media.caption || '', agentId)
                        } else {
                            await whatsapp.sendImage(contact.phone_whatsapp, dataUrl, result.media.caption || '', agentId)
                        }

                        // 2. Mark as Sent
                        const currentSentTo = result.media.sentTo || []
                        if (!currentSentTo.includes(contact.phone_whatsapp)) {
                            await prisma.media.update({
                                where: { id: result.media.id },
                                data: { sentTo: { push: contact.phone_whatsapp } }
                            })
                        }

                        // 3. Save Message to Database (So it shows in UI)
                        await prisma.message.create({
                            data: {
                                conversationId: conversation.id,
                                sender: 'ai',
                                message_text: `[Sent Media: ${keyword}]`,
                                mediaUrl: result.media.url || dataUrl,
                                timestamp: new Date()
                            }
                        })
                    } catch (e: any) {
                        console.error('[Chat] Failed to process AI Image sends', e)
                    }
                })()

        } else {
            // ACTION: REQUEST_SOURCE (Media Missing)
            console.log(`[Chat] ❌ Media missing for "${typeId}". STRICT RULE: Silence & Request Source.`)

            // 1. TRIGGER SOURCE REQUEST
            await mediaService.requestFromSource(contact.phone_whatsapp, typeId, settings, agentId)

            // 2. ABORT RESPONSE (Strict Silence)
            // User requirement: "If you don't have the photo, you don't answer."
            // The response will be handled later when admin provides the media (via processAdminMedia logic).
            console.log(`[Chat] Aborting text response because media is pending.`)
            return { handled: true, result: 'media_pending_silence' }
        }
    }

    // If response is ONLY a reaction, stop here (don't send empty text)
    if (!responseText || responseText.length === 0) {
        // Log reaction-only response
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'ai',
                message_text: `[REACT:${reactionMatch ? reactionMatch[1] : 'unknown'}]`,
                timestamp: new Date()
            }
        })
        return { handled: true, result: 'reaction_only' }
    }

    // Voice Response Logic
    const isPttMessage = payload.type === 'ptt' || payload.type === 'audio'
    const voiceEnabled = settings.voice_response_enabled === 'true' || settings.voice_response_enabled === true

    console.log(`[Voice] responseText: "${responseText}"`)

    let isVoice = voiceEnabled && isPttMessage
    // FLEXIBLE VOICE TAG DETECTION (Regex)
    // Matches: [VOICE], [voice], `[VOICE]`, **[VOICE]**, etc.
    const voiceTagMatch = responseText.match(/(\[VOICE\]|\[voice\])/i)
    if (voiceTagMatch) {
        isVoice = true
        // Remove the tag and cleaner trim
        responseText = responseText.replace(voiceTagMatch[0], '').replace(/[`*]/g, '').trim()
        console.log(`[Chat] Voice Tag Detected via Regex. Cleaned text: "${responseText}"`)
    }

    // NOTE: Message is saved by queue-service AFTER sending, not here (avoids duplicates in dashboard)
    // await prisma.message.create({
    //     data: { conversationId: conversation.id, sender: 'ai', message_text: responseText.replace(/\|\|\|/g, '\n'), timestamp: new Date() }
    // })

    // ═══════════════════════════════════════════════════════════════════════════
    // PRE-SEND CHECK: Look for NEW messages that arrived DURING AI processing
    // If the user sent more messages while we were generating, abort this response
    // and let the latest message's handler deal with ALL messages in context.
    // ═══════════════════════════════════════════════════════════════════════════
    const currentMsgId = (await prisma.message.findFirst({ where: { waha_message_id: payload.id } }))?.id
    if (currentMsgId) {
        const newerUserMessages = await prisma.message.findMany({
            where: {
                conversationId: conversation.id,
                sender: 'contact',
                id: { gt: currentMsgId }
            },
            orderBy: { timestamp: 'asc' }
        })

        if (newerUserMessages.length > 0) {
            console.log(`[Chat] PRE-SEND ABORT: ${newerUserMessages.length} newer message(s) detected. Letting latest handler respond.`)
            logger.info('Pre-send abort: newer messages detected', {
                module: 'chat',
                currentMsgId,
                newerCount: newerUserMessages.length,
                newerIds: newerUserMessages.map(m => m.id)
            })
            // Don't send this response - the newest message's handler will include ALL context
            return { handled: true, result: 'presend_aborted_newer_messages' }
        }
    }
    // ═══════════════════════════════════════════════════════════════════════════


    if (isVoice) {
        const { voiceTtsService } = require('@/lib/voice-tts')
        const voiceText = responseText.replace(/\|+/g, '. ')

        // Check for reusable voice first
        const { voiceService } = require('@/lib/voice')
        const existing = await voiceService.findReusableVoice(voiceText)

        if (existing) {
            if (platform !== 'discord') whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => {})
            await whatsapp.sendVoice(contact.phone_whatsapp, existing.url, payload.id, agentId)
        } else {
            // Use TTS service (no longer requests from human)
            if (platform !== 'discord') whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => {})

            const ttsResult = await voiceTtsService.generateAndSend({
                contactPhone: contact.phone_whatsapp,
                text: voiceText,
                agentId: agentId || effectiveAgentId,
                conversationId: conversation.id,
                contactId: contact.id,
                replyToMessageId: payload.id
            })

            if (!ttsResult.success) {
                // TTS failed - notification sent to admin, they'll choose Continue/Pause
                return { handled: true, result: 'tts_failed_notified', error: ttsResult.error }
            }

            return { handled: true, result: 'voice_tts_sent' }
        }
    } else {
        // Text Send -> Via DB Queue (Reliable)
        if (platform !== 'discord') whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => {})

        // We push the raw responseText (with |||) to DB. The Cron/Worker handles splitting.
        const queuedMsg = await prisma.messageQueue.create({
            data: {
                contactId: contact.id,
                conversationId: conversation.id,
                content: responseText,
                scheduledAt: new Date(),
                status: 'PENDING'
            }
        })
        console.log(`[Chat] Message Queued for delivery. QueueID: ${queuedMsg.id}`)
    }

    // Final return
    return { handled: true, result: 'sent', textBody: responseText }
}

async function callAI(settings: any, conv: any, sys: string | null, ctx: any[], last: string, contact?: any, agentId?: string, platform: 'whatsapp' | 'discord' = 'whatsapp', preloadedProfile?: any) {
    // 🔥 MIGRATION: SWARM-ONLY (Director legacy archived)
    // Le mode SWARM est maintenant le seul mode actif
    
    if (!contact || !agentId) {
        throw new Error('[callAI] SWARM mode requires contact and agentId. Director legacy is archived.')
    }
    
    console.log('[Chat] 🔥 SWARM-ONLY mode - using multi-agent orchestration (Director legacy archived)')
    const { runSwarm } = require('@/lib/swarm')
    const response = await runSwarm(
        last,
        ctx,
        contact.id,
        agentId,
        contact.name || 'friend',
        {
            lastMessageType: contact.lastMessageType || 'text',
            platform,
            preloadedProfile: preloadedProfile || undefined
        }
    )
    // 🚨 REMOVE ALL FORMATTING ARTIFACTS - FORCED UPDATE
    // Remove everything between ** ** (actions like *nods*, *smiles*)
    // Remove leading/trailing asterisks clusters
    // Remove backticks used as quotes
    let cleaned = response
        .replace(/\*\*[^*]*\*\*/g, '')           // **anything**
        .replace(/\*[^*]*\*/g, '')               // *anything*
        .replace(/```/g, '')                     // ``` markers
        .replace(/^\*+/g, '')                    // Leading asterisks
        .replace(/\*+$/g, '')                    // Trailing asterisks
        .replace(/\s+/g, ' ')                     // Normalize spaces
        .trim()
    
    return cleaned
}
