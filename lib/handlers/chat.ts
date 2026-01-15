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
    agentId?: number // Added: Agent Context
) {
    let messageText = messageTextInput

    // 1. View Once Handling
    const isViewOnce = payload._data?.isViewOnce === true || payload.isViewOnce === true
    if (isViewOnce) {
        logger.info('ViewOnce message rejected', { module: 'chat', contactId: contact.id })
        await new Promise(r => setTimeout(r, 2000))
        const refusalMsg = settings.msg_view_once_refusal || "Mince ça bug mon tel, j'arrive pas à ouvrir les photos éphémères (View Once) 😕\n\nTu peux me la renvoyer en normal stp ?"
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
        console.log('Chat: Audio Message Detected. Attempting transcription...')
        try {
            const media = await whatsapp.downloadMedia(payload.id)
            if (media && media.data) {
                const { transcriptionService } = require('@/lib/transcription')
                const buffer = Buffer.from(media.data as unknown as string, 'base64')
                // We now request WAV from Baileys, so use .wav extension
                const ext = 'audio.wav'

                const transcribedText = await transcriptionService.transcribe(buffer, ext)

                if (transcribedText) {
                    messageText = transcribedText // Replace placeholder
                    console.log(`[Chat] Voice Transcribed: "${messageText}"`)
                } else {
                    messageText = "[Voice Message - Transcription Failed]"
                }
            } else {
                console.error(`[Chat] Download Failed for Media ID: ${payload.id}. Media object:`, media ? 'Present (No Data)' : 'NULL')
                messageText = "[Voice Message - Download Failed]"
            }
        } catch (e) {
            console.error('Chat: Transcription Unexpected Error', e)
            messageText = "[Voice Message - Error]"
        }
    }

    // 3. Vision Logic
    const isImageMessage = payload.type === 'image' || payload._data?.mimetype?.startsWith('image')
    if (isImageMessage && !messageText.includes('[Image Description]')) {
        console.log('Chat: Image Detected. Analyzing...')
        try {
            const apiKey = settings.venice_api_key
            if (apiKey) {
                const media = await whatsapp.downloadMedia(payload.id)
                if (media && media.data) {
                    const { visionService } = require('@/lib/vision')
                    const buffer = Buffer.from(media.data as unknown as string, 'base64')
                    const description = await visionService.describeImage(buffer, media.mimetype || 'image/jpeg', apiKey)
                    if (description) {
                        messageText = messageText ? `${messageText}\n\n[Image Description]: ${description}` : `[Image Description]: ${description}`
                    }
                }
            }
        } catch (e) { console.error('Vision Failed', e) }
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
                const buffer = Buffer.from(media.data as unknown as string, 'base64')
                const mime = media.mimetype || (payload.type === 'image' ? 'image/jpeg' : 'video/mp4')

                mediaUrl = await storage.uploadMedia(buffer, mime)
                if (mediaUrl) console.log(`[Chat] Media uploaded: ${mediaUrl}`)
                else console.warn('[Chat] Media upload failed')
            }
        } catch (e) {
            console.error('[Chat] Media handling failed:', e)
        }
    }

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
            await whatsapp.sendText(contact.phone_whatsapp, voiceRefusalMsg, undefined, agentId)
            return { handled: true, result: 'voice_error' }
        }
    }

    if (!conversation.ai_enabled) {
        console.log('[Chat] AI is DISABLED for this conversation.')
        return { handled: true, result: 'ai_disabled' }
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
        return await generateAndSendAI(conversation, contact, settings, messageText, payload, agentId)
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

async function generateAndSendAI(conversation: any, contact: any, settings: any, lastMessageText: string, payload: any, agentId?: number) {
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

    const messagesForAI = uniqueHistory.map((m: any) => ({
        role: m.sender === 'contact' ? 'user' : 'ai',
        content: m.message_text
    }))
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

    director.performDailyTrustAnalysis(contact.phone_whatsapp).catch(console.error)
    const { phase, details } = await director.determinePhase(contact.phone_whatsapp)
    let systemPrompt = await director.buildSystemPrompt(settings, contact, phase, details, conversation.prompt.system_prompt, agentId)

    // Inject memories with clearer phrasing to avoid AI confusing user facts with its own identity
    if (memories.length > 0) {
        const memoryBlock = memories.map((m: any) => `- ${m.memory}`).join('\n')
        systemPrompt += `\n\n[WHAT YOU KNOW ABOUT THE PERSON YOU'RE TALKING TO]:\n${memoryBlock}`
    }

    // 3. Timing
    logger.info('Generating AI response', { module: 'chat', conversationId: conversation.id, phase })
    const lastUserDate = new Date() // Approx
    const timing = TimingManager.analyzeContext(lastUserDate, phase)
    if (contact.testMode) {
        // Use 20-30 second delay even in test mode to prevent rapid-fire responses that destabilize WhatsApp
        timing.delaySeconds = Math.floor(Math.random() * 10) + 20; // Random 20-30 seconds
        timing.mode = 'INSTANT_TEST'
    }

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
        if (timing.shouldGhost) whatsapp.markAsRead(contact.phone_whatsapp, agentId).catch(() => { })
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

    // Voice Response Logic
    let isVoice = (settings.voice_response_enabled === 'true' || settings.voice_response_enabled === true) && (payload.type === 'ptt' || payload.type === 'audio')
    if (responseText.startsWith('[VOICE]')) { isVoice = true; responseText = responseText.replace('[VOICE]', '').trim() }

    await prisma.message.create({
        data: { conversationId: conversation.id, sender: 'ai', message_text: responseText.replace(/\|\|\|/g, '\n'), timestamp: new Date() }
    })

    if (isVoice) {
        const { voiceService } = require('@/lib/voice')
        const voiceText = responseText.replace(/\|\|\|/g, '. ')
        const existing = await voiceService.findReusableVoice(voiceText)
        if (existing) {
            whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload?.messageKey).catch(() => { })
            await whatsapp.sendVoice(contact.phone_whatsapp, existing.url, payload.id, agentId)
        } else {
            await voiceService.requestVoice(contact.phone_whatsapp, voiceText, lastContent, settings)
            return { handled: true, result: 'voice_requested' }
        }
    } else {
        // Text Send -> Via DB Queue (Reliable)
        whatsapp.markAsRead(contact.phone_whatsapp, agentId, payload?.messageKey).catch(() => { })

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

    return { handled: true, result: 'sent' }
}

async function callAI(settings: any, conv: any, sys: string, ctx: any[], last: string) {
    const provider = settings.ai_provider || 'openrouter'
    const params = {
        apiKey: provider === 'anthropic' ? settings.anthropic_api_key : (provider === 'openrouter' ? settings.openrouter_api_key : settings.venice_api_key),
        model: provider === 'anthropic' ? settings.anthropic_model : (provider === 'openrouter' ? settings.openrouter_model : conv.prompt.model),
        temperature: settings.ai_temperature ? Number(settings.ai_temperature) : Number(conv.prompt.temperature),
        max_tokens: conv.prompt.max_tokens
    }

    console.log(`[Chat] Calling Provider: ${provider}, Model: ${params.model}`)

    let txt = ""
    if (provider === 'anthropic') txt = await anthropic.chatCompletion(sys, ctx, last, params)
    else if (provider === 'openrouter') txt = await openrouter.chatCompletion(sys, ctx, last, params)
    else txt = await venice.chatCompletion(sys, ctx, last, params)

    return txt.replace(new RegExp('\\*[^*]+\\*', 'g'), '').trim()
}
