// lib/handlers/chat.ts
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { venice } from '@/lib/venice'
import { anthropic } from '@/lib/anthropic'
import { openrouter } from '@/lib/openrouter'
import { TimingManager } from '@/lib/timing'
import { logger } from '@/lib/logger'
// import { messageQueue } from '@/lib/queue' // Deprecated
import { NextResponse } from 'next/server'



export async function handleChat(
    payload: any,
    contact: any,
    conversation: any,
    settings: any,
    messageTextInput: string, // The initial text (or transcribed voice from caller)
    agentId?: string, // Added: Agent Context
    options?: { skipAI?: boolean } // Added: Burst Mode Support
) {
    let messageText = messageTextInput

    // 1. View Once Handling
    const isViewOnce = payload._data?.isViewOnce === true || payload.isViewOnce === true
    if (isViewOnce) {
        logger.info('ViewOnce message rejected', { module: 'chat', contactId: contact.id })
        await new Promise(r => setTimeout(r, 2000))
        const refusalMsg = settings.msg_view_once_refusal || "Mince ça bug mon tel, j'arrive pas à ouvrir les photos éphémères (View Once) 😕\n\nTu peux me la renvoyer en normal stp ?"
        await whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => { })
        await whatsapp.sendText(contact.phone_whatsapp, refusalMsg, undefined, agentId)
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
                    messageText = transcribedText // Replace placeholder
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
    } catch (e: any) {
        if (e.code === 'P2002') return { handled: true, result: 'duplicate' }
        throw e
    }

    // PAYMENT DETECTION: Check if user is claiming to have made a payment
    // This runs BEFORE AI generation to ensure notifications are sent immediately
    try {
        const { processPaymentClaim } = require('@/lib/services/payment-claim-handler')
        const paymentResult = await processPaymentClaim(messageText, contact, conversation, settings, agentId)
        if (paymentResult.processed) {
            logger.info('Payment claim detected and processed', {
                module: 'chat',
                contactId: contact.id,
                claimId: paymentResult.claimId
            })
        }
    } catch (e: any) {
        logger.error('Payment detection failed (non-blocking)', e, { module: 'chat' })
    }

    // BURST MODE: If we are processing a batch of messages, we might want to skip AI for all but the last one.
    // The message is already saved above, so context is preserved.
    if (options?.skipAI) {
        logger.info('Burst Mode: Skipping AI generation for message', { module: 'chat', contactId: contact.id, method: 'burst_skip' })
        return { handled: true, result: 'saved_skipped_ai' }
    }

    // 5. Checks (Paused/VoiceFail)
    if (conversation.status === 'paused') {
        console.log('[Chat] Conversation is PAUSED. Ignoring message.')
        logger.info('Conversation paused', { module: 'chat', conversationId: conversation.id })
        return { handled: true, result: 'paused' }
    }
    if (messageText.startsWith('[Voice Message -')) {
        // If transcription FAILED, we send refusal.
        // If it succeeded, messageText will be the actual text, so we skip this block.
        if (messageText.includes('Failed') || messageText.includes('Error') || messageText.includes('Disabled')) {
            const voiceRefusalMsg = settings.msg_voice_refusal || "Désolé, je ne peux pas écouter les messages vocaux pour le moment (Problème technique)."
            await whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => { })
            await whatsapp.sendText(contact.phone_whatsapp, voiceRefusalMsg, undefined, agentId)
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

        // Background Profiler (30%)
        if (Math.random() < 0.3) {
            const { profilerService } = require('@/lib/profiler')
            profilerService.updateProfile(contact.id).catch(console.error)
        }
    }

    // 7. Spinlock
    await acquireLock(conversation.id)

    try {
        // AI GENERATION LOGIC
        // Pass options (containing previousResponse) to the generator
        const result = await generateAndSendAI(conversation, contact, settings, messageText, payload, agentId, options)

        // 8. Payment Claim Detection: MOVED to Tag-Based in generateAndSendAI
        // We no longer scan user text. We listen for [PAYMENT_RECEIVED] from AI.

        return result
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

async function generateAndSendAI(conversation: any, contact: any, settings: any, lastMessageText: string, payload: any, agentId?: string, options?: any) {
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
    const contextMessages = messagesForAI.slice(0, -1)
    const lastContent = messagesForAI[messagesForAI.length - 1]?.content || lastMessageText

    // 2. Memory & Director
    const { memoryService } = require('@/lib/memory')
    const { director } = require('@/lib/director')

    // Load ALL memories for this user (agent-specific if agentId available)
    let memories: any[] = []
    try {
        // Use agent-isolated memories if agentId is known
        const memoryUserId = agentId
            ? memoryService.buildUserId(contact.phone_whatsapp, agentId)
            : contact.phone_whatsapp
        const res = await memoryService.getAll(memoryUserId)
        memories = Array.isArray(res) ? res : (res?.results || res?.memories || [])
        console.log(`[Chat] Loaded ${memories.length} memories for ${memoryUserId}`)
    } catch (e) {
        console.warn('[Chat] Memory retrieval failed', e)
    }

    // Check for Trust Analysis Trigger
    // Trigger every 10 messages OR if > 12 hours since last analysis
    const MSG_INTERVAL = 10;
    const TIME_INTERVAL = 12 * 60 * 60 * 1000;

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

    if (shouldAnalyze) {
        console.log(`[Chat] Triggering Trust Analysis for ${contact.phone_whatsapp}...`);
        // Run in background to not block response
        director.performTrustAnalysis(contact.phone_whatsapp).catch(console.error);
    }

    const effectiveAgentId = agentId || conversation?.agentId || 1 // Fallback to 1 if absolutely missing
    const { phase, details, reason } = await director.determinePhase(contact.phone_whatsapp, effectiveAgentId)
    let systemPrompt = await director.buildSystemPrompt(settings, contact, phase, details, conversation.prompt.system_prompt, effectiveAgentId, reason)

    // Inject memories with clearer phrasing to avoid AI confusing user facts with its own identity
    if (memories.length > 0) {
        const memoryBlock = memories.map((m: any) => `- ${m.memory}`).join('\n')
        systemPrompt += `\n\n[WHAT YOU KNOW ABOUT THE PERSON YOU'RE TALKING TO]:\n${memoryBlock}`
    }

    // 3. Timing
    logger.info('Generating AI response', { module: 'chat', conversationId: conversation.id, phase })
    const lastUserDate = new Date() // Approx

    // Fetch Agent Timezone
    let agentTimezone = 'Europe/Paris' // Default safe fallback
    if (effectiveAgentId) {
        try {
            const agentProfile = await prisma.agentProfile.findUnique({
                where: { agentId: effectiveAgentId },
                select: { timezone: true }
            })
            if (agentProfile?.timezone) agentTimezone = agentProfile.timezone
        } catch (e) {
            console.warn('[Chat] Failed to fetch agent timezone, using default:', e)
        }
    }

    // Check for High Priority Keywords (for timing adjustment only)
    // Payment detection is now handled earlier (after message save)
    const moneyKeywords = ['money', 'pay', 'paypal', 'cashapp', 'venmo', 'zelle', 'transfer', 'cash', 'dollars', 'usd', '$', 'price', 'cost', 'bank', 'card', 'crypto', 'bitcoin']
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

    // Queue if delay > 22s
    if (timing.delaySeconds > 22) {
        const scheduledAt = new Date(Date.now() + timing.delaySeconds * 1000)

        // Generate NOW
        const responseText = await callAI(settings, conversation, systemPrompt, contextMessages, lastContent)

        await prisma.messageQueue.create({
            data: {
                contactId: contact.id,
                conversationId: conversation.id,
                content: responseText,
                scheduledAt: scheduledAt,
                status: 'PENDING'
            }
        })
        if (timing.shouldGhost) whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => { })
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
        let currentSystemPrompt = systemPrompt
        if (attempts > 1) {
            logger.info('AI retry due to empty response', { module: 'chat', attempt: attempts, conversationId: conversation.id })
            currentSystemPrompt += settings.prompt_ai_retry_logic || "\n\n[SYSTEM CRITICAL]: Your previous response was valid actions like *nods* but contained NO spoken text. You MUST write spoken text now. Do not just act. Say something."
        }

        try {
            responseText = await callAI(settings, conversation, currentSystemPrompt, contextMessages, lastContent)
        } catch (error: any) {
            console.error(`[Chat] AI Attempt ${attempts} failed:`, error.message)

            // CRITICAL: Handle Async Job Handoff
            if ((error as any).isAsyncJob || error.message?.startsWith('RUNPOD_ASYNC_JOB')) {
                const jobId = (error as any).jobId || error.message.split(':')[1]
                console.log(`[Chat] Async Job Started: ${jobId}. Stopping sync execution.`)
                return { handled: true, result: 'async_job_started', jobId }
            }

            // CRITICAL: Handle Quota/Payment Errors (402)
            if (error.message?.includes('402') || error.message?.includes('Insufficient balance') || error.message?.includes('Quota')) {
                console.log('[Chat] AI Quota Exceeded. Queuing as AI_FAILED for manual attention.')

                await prisma.messageQueue.create({
                    data: {
                        contactId: contact.id,
                        conversationId: conversation.id,
                        content: `[SYSTEM: AI GENERATION FAILED]\nReason: Insufficient Credits (402)\nOriginal User Message: "${lastContent}"`,
                        status: 'AI_FAILED_402',
                        scheduledAt: new Date()
                    }
                })
                return { handled: true, result: 'ai_quota_failed' }
            }

            // If it's a temporary error, we let the loop retry (up to MAX_RETRIES)
            if (attempts >= MAX_RETRIES) throw error
        }

        // Valid response found?
        if (responseText && responseText.trim().length > 0) break
    }

    console.log(`[Chat] AI Response: "${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}"`)

    // Safety: Final Check (If still empty after retries, abort)
    if (!responseText || responseText.trim().length === 0) {
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
        await whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => { })
        whatsapp.sendReaction(contact.phone_whatsapp, payload.id, emoji, agentId)
            .catch(err => console.error('[Chat] Failed to send reaction:', err))

        console.log(`[Chat] AI sent reaction: ${emoji}`)
    }

    // Payment tag detection removed - payments are now detected directly from user messages
    // before AI generation (see line 184-197)


    // Image Logic ([IMAGE:keyword])
    const imageMatch = responseText.match(/\[IMAGE:(.+?)\]/)
    if (imageMatch) {
        const keyword = imageMatch[1].trim()
        responseText = responseText.replace(imageMatch[0], '').trim()
        console.log(`[Chat] AI wanted to send image: ${keyword}`)

        // Handle Image Async (Fire & Forget)
        const { mediaService } = require('@/lib/media'); // Lazy import
        (async () => {
            try {
                const typeId = await mediaService.findMediaTypeByKeyword(keyword)
                if (!typeId) {
                    console.log(`[Chat] Image keyword "${keyword}" not found in MediaTypes.`)
                    return
                }

                const result = await mediaService.processRequest(contact.phone_whatsapp, typeId)

                if (result.action === 'SEND' && result.media) {
                    console.log(`[Chat] Found media ${result.media.id} for "${typeId}". Sending...`)

                    // 1. Send Image
                    // Ensure data is proper DataURL or Base64 (assuming stored as Base64 or URL)
                    let dataUrl = result.media.data
                    if (dataUrl && !dataUrl.startsWith('http') && !dataUrl.startsWith('data:')) {
                        dataUrl = `data:${result.media.mimeType || 'image/jpeg'};base64,${dataUrl}`
                    }

                    await whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => { })
                    await whatsapp.sendImage(contact.phone_whatsapp, dataUrl, result.media.caption || '', agentId)

                    // 2. Mark as Sent
                    // sentTo is String[]
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
                            mediaUrl: result.media.url || dataUrl, // Store URL or Base64 (prefer URL if available)
                            timestamp: new Date()
                        }
                    })
                } else if (result.action === 'REQUEST_SOURCE') {
                    console.log(`[Chat] No media for "${typeId}". Requesting source...`)
                    await mediaService.requestFromSource(contact.phone_whatsapp, typeId, settings, agentId)
                }
            } catch (e: any) {
                console.error('[Chat] Failed to process AI Image request', e)
            }
        })()
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
    if (responseText.startsWith('[VOICE]')) { isVoice = true; responseText = responseText.replace('[VOICE]', '').trim() }

    // NOTE: Message is saved by queue-service AFTER sending, not here (avoids duplicates in dashboard)
    // await prisma.message.create({
    //     data: { conversationId: conversation.id, sender: 'ai', message_text: responseText.replace(/\|\|\|/g, '\n'), timestamp: new Date() }
    // })

    if (isVoice) {
        const { voiceService } = require('@/lib/voice')
        const voiceText = responseText.replace(/\|\|\|/g, '. ')
        const existing = await voiceService.findReusableVoice(voiceText)
        if (existing) {
            whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => { })
            await whatsapp.sendVoice(contact.phone_whatsapp, existing.url, payload.id, agentId)
        } else {
            // Mark as read immediately to acknowledge request
            whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => { })
            await voiceService.requestVoice(contact.phone_whatsapp, voiceText, lastContent, settings, agentId)
            return { handled: true, result: 'voice_requested' }
        }
    } else {
        // Text Send -> Via DB Queue (Reliable)
        whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload.messageKey).catch(() => { })

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

async function callAI(settings: any, conv: any, sys: string, ctx: any[], last: string) {
    // PRIMARY PROVIDER: VENICE
    // Fallback logic is handled inside venice.ts (to RunPod)

    // Explicitly check for 'runpod' override setting only if needed, otherwise default to Venice.
    // User requested: Venice Principal, RunPod Secondaire (fallback), OpenRouter Dégage.

    // However, we respect the 'ai_provider' setting specifically if it forces runpod.
    // If it's 'anthropic' or 'openrouter', we FORCE Venice anyway based on user request "OpenRouter dégage".

    const provider = settings.ai_provider === 'runpod' ? 'runpod' : 'venice'

    const params = {
        apiKey: provider === 'runpod' ? settings.runpod_api_key : settings.venice_api_key,
        model: provider === 'runpod' ? (conv.prompt?.model || 'runpod/model') : (settings.venice_model || 'venice-uncensored'),
        temperature: settings.ai_temperature ? Number(settings.ai_temperature) : Number(conv.prompt?.temperature || 0.7),
        max_tokens: conv.prompt?.max_tokens || 500
    }

    console.log(`[Chat] Provider Selection: ${provider.toUpperCase()}`)
    console.log(`[Chat] API Key Present: ${params.apiKey ? 'YES' : 'NO'}`)

    let txt = ""
    if (provider === 'venice') {
        const { venice } = require('@/lib/venice')
        // Venice wrapper handles the fallback to RunPod internally on failure (402, 500, etc.)
        txt = await venice.chatCompletion(sys, ctx, last, params)
    } else {
        // RunPod Direct
        const { runpod } = require('@/lib/runpod')
        txt = await runpod.chatCompletion(sys, ctx, last, params)
    }

    return txt.replace(new RegExp('\\*[^*]+\\*', 'g'), '').trim()
}
