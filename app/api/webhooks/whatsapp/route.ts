import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { anthropic } from '@/lib/anthropic'
import { whatsapp } from '@/lib/whatsapp'
import { TimingManager } from '@/lib/timing'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        // Payload structure from our new service:
        // { event: 'message', payload: { from, body, fromMe, type, _data: { notifyName, mimetype }, ... } }

        if (body.event !== 'message') {
            return NextResponse.json({ success: true, ignored: true })
        }

        const payload = body.payload

        // Ignore own messages
        if (payload.fromMe) {
            return NextResponse.json({ success: true, ignored: true })
        }

        const from = payload.from // e.g. 33612345678@c.us
        if (!from.includes('@c.us')) {
            // Group or status, ignore
            return NextResponse.json({ success: true, ignored: true })
        }

        // Standardize phone number
        const phone_whatsapp = from.split('@')[0]
        const normalizedPhone = `+${phone_whatsapp}`

        // Fetch Settings Early
        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        // Detect Intent (Smart Logic)
        let messageText = payload.body || ""

        // --- 1. Source (Admin) Logic ---
        const adminPhone = settings.source_phone_number
        const mediaSourcePhone = settings.media_source_number || adminPhone
        const voiceSourcePhone = settings.voice_source_number || adminPhone
        const leadProviderPhone = settings.lead_provider_number || adminPhone

        // Check if sender is privileged
        const isPrivilegedSender =
            (adminPhone && normalizedPhone.includes(adminPhone.replace('+', ''))) ||
            (mediaSourcePhone && normalizedPhone.includes(mediaSourcePhone.replace('+', ''))) ||
            (voiceSourcePhone && normalizedPhone.includes(voiceSourcePhone.replace('+', ''))) ||
            (leadProviderPhone && normalizedPhone.includes(leadProviderPhone.replace('+', '')))

        if (isPrivilegedSender) {
            console.log(`[Webhook] Privileged message from ${normalizedPhone}`)
            const text = messageText
            const sourcePhone = normalizedPhone.split('@')[0] // Just the number

            // 1. Admin Commands (Problem, Cancel, etc.)
            const { handleAdminCommand } = require('@/lib/handlers/admin')
            const adminResult = await handleAdminCommand(text, sourcePhone, settings)
            if (adminResult.handled) {
                return NextResponse.json({ success: true, handler: adminResult.type })
            }

            // 2. Media/Voice Ingestion
            const { handleSourceMedia } = require('@/lib/handlers/media')
            const mediaResult = await handleSourceMedia(payload, sourcePhone, normalizedPhone, settings)
            if (mediaResult.handled) {
                return NextResponse.json({ success: true, handler: mediaResult.type })
            }

            // I. LEAD PROVIDER LOGIC
            // Check if this user is the Lead Provider (and not just Admin doing admin stuff)
            const isLeadProvider = leadProviderPhone && normalizedPhone.includes(leadProviderPhone.replace('+', ''))

            if (isLeadProvider) {
                // It could be Text OR Voice
                // If Voice, we need transcription!
                let content = messageText

                const isAudio = payload.type === 'ptt' || payload.type === 'audio' || payload._data?.mimetype?.startsWith('audio')
                if (isAudio) {
                    console.log('[LeadProvider] Voice detected. Transcribing for context...')
                    let mediaData = payload.body
                    if (!mediaData || mediaData.length < 100) {
                        mediaData = await whatsapp.downloadMedia(payload.id)
                    }
                    if (mediaData && mediaData.data && settings.cartesia_api_key) {
                        const { cartesia } = require('@/lib/cartesia')
                        content = await cartesia.transcribeAudio(mediaData.data, settings.cartesia_api_key)
                        console.log(`[LeadProvider] Transcribed: "${content}"`)
                    }
                }

                if (content) {
                    const { leadService } = require('@/lib/leads')
                    await leadService.handleProviderMessage(normalizedPhone, content)
                    return NextResponse.json({ success: true, handler: 'lead_provider_flow' })
                }
            }


            // J. Admin Chat Logic (Legacy) -> Only if not Lead Provider flow took over
            // Use AI to reply to admin? Or just ignore?
            // Existing logic below might reply with AI if we don't return.


            return NextResponse.json({ success: true, ignored: true, reason: 'admin_text' });
        } // End Source (Admin) Logic

        // --- 2. User Media Request Logic ---

        // Find/Create Contact using Upsert
        const contact = await prisma.contact.upsert({
            where: { phone_whatsapp: normalizedPhone },
            update: {}, // No updates if exists
            create: {
                phone_whatsapp: normalizedPhone,
                name: payload._data?.notifyName || "Inconnu",
                source: 'WhatsApp Incoming',
                status: 'new'
            }
        })

        const { mediaService } = require('@/lib/media')

        // Detect Intent (Smart Logic)
        // ... (Skipping checks for brevity, we assume existing logic is fine)
        if (payload.type === 'chat') {
            try {
                const analysis = await mediaService.analyzeRequest(messageText)

                if (analysis && analysis.isMediaRequest) {
                    if (!analysis.allowed) {
                        console.log(`Media Request Blocked: ${analysis.refusalReason}`)

                        // Fix: Do NOT send the raw refusal reason.
                        // Instead, ask the AI to refuse naturally based on the reason.
                        const refusalReason = analysis.refusalReason || "forbidden content"
                        const refusalSystemPrompt = `(SYSTEM: The user requested media that is STRICTLY FORBIDDEN. Reason: "${refusalReason}". 
INSTRUCTION: You must REFUSE this request naturally but GENTLY.
- Do NOT be mean or firm. Be SHY and HESITANT.
- Use excuses like: "idk i'm not comfortable yet...", "maybe later...", "im kinda shy lol", "umm i barely know u".
- Leave the door open for later (don't say "never").
- Keep it cute and casual, lowercase.)`

                        // Find existing conversation to get the right model/prompt context
                        let currentConversation = await prisma.conversation.findFirst({
                            where: { contactId: contact.id, status: { in: ['active', 'paused'] } },
                            include: { prompt: true }
                        })

                        const provider = settings.ai_provider || 'venice'
                        let aiRefusal = ""

                        // Use the main system prompt + our refusal instruction
                        const mainPrompt = currentConversation?.prompt?.system_prompt || "You are a friend."

                        if (provider === 'anthropic') {
                            aiRefusal = await anthropic.chatCompletion(mainPrompt, [], refusalSystemPrompt, { apiKey: settings.anthropic_api_key, model: settings.anthropic_model })
                        } else {
                            aiRefusal = await venice.chatCompletion(mainPrompt, [], refusalSystemPrompt, { apiKey: settings.venice_api_key, model: settings.venice_model })
                        }

                        await whatsapp.sendText(contact.phone_whatsapp, aiRefusal)

                        // Save the interaction
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

                        return NextResponse.json({ success: true, handler: 'media_request_blocked' })
                    }

                    if (analysis.intentCategory) {
                        console.log(`Media Intent Verified: ${analysis.intentCategory}`)
                        const result = await mediaService.processRequest(contact.phone_whatsapp, analysis.intentCategory)

                        if (result.action === 'SEND') {
                            console.log('Media found in bank. Sending...')
                            const dataUrl = result.media.url
                            if (dataUrl.startsWith('data:image')) {
                                await whatsapp.sendImage(contact.phone_whatsapp, dataUrl)
                            } else {
                                await whatsapp.sendVideo(contact.phone_whatsapp, dataUrl)
                            }

                            // Mark sent
                            await prisma.media.update({
                                where: { id: result.media.id },
                                data: { sentTo: { push: contact.phone_whatsapp } }
                            })

                            // Mem0 Log + DB Save (System Action)
                            const { memoryService } = require('@/lib/memory')
                            await memoryService.add(contact.phone_whatsapp, messageText)
                            await memoryService.add(contact.phone_whatsapp, `[System]: Sent media ${analysis.intentCategory}`)

                            // We don't save the image itself in messages table usually, but we could save a text placeholder
                            // Find active conv to attach message
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
                                }).catch(e => console.error("Failed to save system media msg", e))
                            }

                            return NextResponse.json({ success: true, handler: 'media_sent' })

                        } else if (result.action === 'REQUEST_SOURCE') {
                            console.log('No media in bank. Requesting from Source...')
                            const status = await mediaService.requestFromSource(contact.phone_whatsapp, analysis.intentCategory)

                            let currentConversation = await prisma.conversation.findFirst({
                                where: { contactId: contact.id, status: 'active' },
                                include: { prompt: true }
                            })

                            let activePrompt: any = currentConversation?.prompt
                            if (!activePrompt) {
                                activePrompt = await prisma.prompt.findFirst({ where: { isActive: true } })
                            }

                            const instruction = status === 'REQUEST_NEW'
                                ? `(SYSTEM: The user wants a photo of ${analysis.intentCategory}. You don't have it right now. Tell them naturally you'll check later. 
IMPORTANT: You are a REAL PERSON. NEVER say you are an AI. NEVER say you don't have a body. If you can't send it, say you are busy, shy, or the lighting is bad.
If you want to break your response into two messages, use "|||")`
                                : `(SYSTEM: The user is asking AGAIN for ${analysis.intentCategory}. You already said you'd check. Tell them to be patient naturally. 
IMPORTANT: REMAIN IN CHARACTER. Do NOT admit to being an AI. Use "|||" to split messages if needed.)`;

                            // Generate Response
                            // We use the same provider as settings
                            const provider = settings.ai_provider || 'venice'
                            let responseText = ""

                            // We need the last user message to make sense of language
                            const userMessageForAI = messageText + "\n\n" + instruction;

                            if (provider === 'anthropic') {
                                responseText = await anthropic.chatCompletion(
                                    activePrompt?.system_prompt || "You are a helpful assistant.",
                                    [],
                                    userMessageForAI,
                                    { apiKey: settings.anthropic_api_key, model: settings.anthropic_model || 'claude-3-haiku-20240307' }
                                );
                            } else {
                                responseText = await venice.chatCompletion(
                                    activePrompt?.system_prompt || "You are a helpful assistant.",
                                    [],
                                    userMessageForAI,
                                    { apiKey: settings.venice_api_key, model: settings.venice_model || 'venice-uncensored' }
                                );
                            }

                            // SPLIT MESSAGE LOGIC
                            const parts = responseText.split('|||').filter(p => p.trim().length > 0)

                            for (const part of parts) {
                                const cleanPart = part.trim()
                                await whatsapp.sendTypingState(contact.phone_whatsapp, true)
                                // Random delay for typing
                                const charDelay = 30 + Math.random() * 20
                                const typingDuration = Math.min(cleanPart.length * charDelay, 10000)
                                await new Promise(r => setTimeout(r, typingDuration + 1000))

                                await whatsapp.sendText(contact.phone_whatsapp, cleanPart)

                                // Pause between bubbles if there are more
                                if (parts.indexOf(part) < parts.length - 1) {
                                    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))
                                }
                            }

                            if (currentConversation) {
                                await prisma.message.create({
                                    data: {
                                        conversationId: currentConversation.id,
                                        sender: 'ai',
                                        message_text: responseText.replace(/\|\|\|/g, '\n'), // Save full text but normalized
                                        timestamp: new Date()
                                    }
                                })
                                // Save request too to prompt context?
                                await prisma.message.create({
                                    data: {
                                        conversationId: currentConversation.id,
                                        sender: 'contact',
                                        message_text: messageText,
                                        timestamp: new Date()
                                    }
                                })
                            }

                            return NextResponse.json({ success: true, handler: 'media_request_pending_dynamic' })
                        }
                    }
                }
            } catch (mediaError: any) {
                console.error('[MediaLogic] Unexpected Error:', mediaError)
                // Fallthrough to normal conversational AI if media logic breaks?
                // Or just return success to avoid retries
                // Let's fall through but logging it
            }
        }    // If not isMediaRequest, fall through to conversational AI



        // Find existing Conversation (Active OR Paused)
        // Fix: Do not filter by 'active' only, otherwise 'paused' conversations are ignored and duplicated.
        let conversation = await prisma.conversation.findFirst({
            where: {
                contactId: contact.id,
                // We want the latest open conversation. 
                // Assuming 'closed' is the only terminal state we ignore? 
                // Or maybe just find the last created one.
                status: { in: ['active', 'paused'] }
            },
            orderBy: { createdAt: 'desc' }, // Get the latest one
            include: { prompt: true }
        })

        if (conversation) {
            console.log(`[Webhook] Found Conversation ID: ${conversation.id}, Status: ${conversation.status}`)
        } else {
            console.log(`[Webhook] No Conversation found. Creating new (Paused).`)
        }

        if (!conversation) {
            const defaultPrompt = await prisma.prompt.findFirst({ where: { isActive: true } }) || await prisma.prompt.findFirst()
            if (!defaultPrompt) return NextResponse.json({ error: 'No prompt configured' }, { status: 500 })

            // Create Conversation (PAUSED BY DEFAULT for Cold Start)
            conversation = await prisma.conversation.create({
                data: {
                    contactId: contact.id,
                    promptId: defaultPrompt.id,
                    status: 'paused', // <--- FIXED: Paused by default (Wait for Context)
                    ai_enabled: true
                },
                include: { prompt: true }
            })
        }

        // 3. Save Incoming Message
        // Idempotency Check: Prevent duplicate processing
        const existingMessage = await prisma.message.findFirst({
            where: { waha_message_id: payload.id }
        })

        if (existingMessage) {
            console.log(`[Webhook] Duplicate Message ID ${payload.id} detected. Skipping.`)
            return NextResponse.json({ success: true, ignored: true, reason: 'duplicate' })
        }

        // Voice Transcription Logic
        const isVoiceMessage = payload.type === 'ptt' || payload.type === 'audio' || payload._data?.mimetype?.startsWith('audio')

        // --- VIEW ONCE HANDLING (Anti-ViewOnce) ---
        // WAHA exposes `isViewOnce` in `_data`.
        const isViewOnce = payload._data?.isViewOnce === true || payload.isViewOnce === true

        if (isViewOnce) {
            console.log('[Webhook] ViewOnce Detected. Rejecting with "Phone Bug" excuse.')
            // Wait a bit to simulate trying to open it
            await new Promise(r => setTimeout(r, 2000))

            // Send excuse
            await whatsapp.sendText(contact.phone_whatsapp, "Mince ça bug mon tel, j'arrive pas à ouvrir les photos éphémères (View Once) 😕\n\nTu peux me la renvoyer en normal stp ?")
            return NextResponse.json({ success: true, handler: 'view_once_rejected' })
        }

        if (isVoiceMessage) {
            console.log('Voice Message Detected. Attempting Transcription via Cartesia...')
            try {
                const apiKey = settings.cartesia_api_key
                if (apiKey) {
                    const media = await whatsapp.downloadMedia(payload.id)
                    if (media && media.data) {
                        const { cartesia } = require('@/lib/cartesia')
                        const transcript = await cartesia.transcribeAudio(media.data, { apiKey })

                        if (transcript) {
                            console.log('Transcription Success:', transcript)
                            messageText = `[Voice Message Transcribed]: ${transcript}`
                        } else {
                            messageText = "[Voice Message - Transcription Empty]"
                        }
                    } else {
                        messageText = "[Voice Message - Download Failed]"
                    }
                } else {
                    messageText = "[Voice Message - Transcription Disabled (No API Key)]"
                }
            } catch (err: any) {
                console.error('Transcription Failed:', err)
                messageText = `[Voice Message - Transcription Error: ${err.message}]`
            }
        }

        // Vision Logic (Image Description)
        const isImageMessage = payload.type === 'image' || payload._data?.mimetype?.startsWith('image')
        if (isImageMessage && !messageText.includes('[Image]')) { // Avoid double processing if text caption exists? Actually caption usually comes with image.
            console.log('Image Message Detected. Attempting Vision Analysis...')
            try {
                const apiKey = settings.venice_api_key
                if (apiKey) {
                    const media = await whatsapp.downloadMedia(payload.id)
                    if (media && media.data) {
                        const { visionService } = require('@/lib/vision')
                        // Convert base64 string to Buffer
                        const buffer = Buffer.from(media.data as unknown as string, 'base64')
                        const mime = media.mimetype || 'image/jpeg'

                        const description = await visionService.describeImage(buffer, mime, apiKey)

                        if (description) {
                            console.log('Vision Success:', description)
                            // Append description to existing text (caption) or replace strict placeholder
                            messageText = messageText ? `${messageText}\n\n[Image Description]: ${description}` : `[Image Description]: ${description}`
                        } else {
                            messageText = messageText ? `${messageText}\n[Image - Analysis Failed]` : `[Image - Analysis Failed]`
                        }
                    }
                }
            } catch (err: any) {
                console.error('[Vision] Failed:', err)
            }
        }

        // Save User Message (ONCE)
        try {
            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    sender: 'contact',
                    message_text: messageText,
                    waha_message_id: payload.id,
                    timestamp: new Date()
                }
            })
        } catch (e: any) {
            // P2002 = Unique constraint violation
            if (e.code === 'P2002') {
                console.log(`[Webhook] Duplicate Message ID ${payload.id} detected during INSERT (Race condition caught). Skipping.`)
                return NextResponse.json({ success: true, ignored: true, reason: 'duplicate_race' })
            }
            throw e // Rethrow real errors
        }

        // 4. COLD START Logic: If Paused, Notify Admin and Exit
        if (conversation.status === 'paused') {
            console.log(`[Webhook] Conversation ${conversation.id} is PAUSED. Skipping AI.`)
            console.log(`[Webhook] Conversation ${conversation.id} is PAUSED. Waiting for admin activation.`)
            return NextResponse.json({ status: 'paused', message: 'Message saved. AI is paused.' })
        }

        // Safety: If voice failed, do NOT trigger AI (prevents loops)
        if (messageText.startsWith('[Voice Message -')) {
            console.log("Voice processing failed or disabled, skipping AI.")
            await whatsapp.sendText(contact.phone_whatsapp, "Désolé, je ne peux pas écouter les messages vocaux pour le moment.")
            return NextResponse.json({ success: true })
        }

        // --- DEBOUNCE / BUFFERING LOGIC ---
        // Wait to see if user sends more messages (e.g. "Hi", "How are you")
        // This prevents the AI from replying to every single line instantly.
        if (conversation.ai_enabled) {
            // TEST MODE CHECK: Bypass delay if testMode is ON
            if (contact.testMode) {
                console.log(`[Debounce] Test Mode Active for ${contact.phone_whatsapp}. Bypassing delay.`)
            } else {
                const DEBOUNCE_MS = 6000 // 6 seconds wait
                console.log(`[Debounce] Waiting ${DEBOUNCE_MS}ms to check for subsequent messages...`)
                await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS))

                // Check if a newer message has arrived for this conversation
                const newerMessage = await prisma.message.findFirst({
                    where: {
                        conversationId: conversation.id,
                        sender: 'contact',
                        timestamp: {
                            gt: new Date(Date.now() - DEBOUNCE_MS + 500) // Look for msgs created *after* we started waiting (approx)
                            // Better: id > currentId if auto-increment? Yes.
                            // But let's use ID comparison to be safe.
                        },
                        id: { gt: (await prisma.message.findFirst({ where: { waha_message_id: payload.id } }))?.id || 0 }
                    }
                })

                if (newerMessage) {
                    console.log(`[Debounce] Found newer message (ID: ${newerMessage.id}). Delegating processing to the latest execution.`)
                    return NextResponse.json({ success: true, handler: 'debounced_delegated' })
                }

                console.log('[Debounce] No newer messages found. Proceeding to AI generation.')
            }

            // --- PROFILER TRIGGER ---
            // Run occasionally (30% chance) to extract info
            if (Math.random() < 0.3) {
                console.log('[Profiler] Triggering background extraction...')
                const { profilerService } = require('@/lib/profiler')
                // No await -> Run in background (Fire & Forget)
                profilerService.updateProfile(contact.id).catch((e: any) => console.error('[Profiler] BG Error:', e))
            }
        }

        if (conversation.ai_enabled) {
            // --- SPINLOCK LOGIC: SEQUENTIAL PROCESSING ---
            // Ensure we process one message at a time for this conversation context.
            // 1. Check Lock
            const LOCK_TIMEOUT = 30000 // 30s max lock
            let isLocked = true
            let retryCount = 0

            while (isLocked && retryCount < 15) { // Try for ~15-20 seconds
                const freshConv = await prisma.conversation.findUnique({ where: { id: conversation.id } })
                if (!freshConv?.processingLock || new Date().getTime() - freshConv.processingLock.getTime() > LOCK_TIMEOUT) {
                    isLocked = false
                } else {
                    console.log(`[Spinlock] Conversation ${conversation.id} locked. Waiting... (${retryCount})`)
                    await new Promise(r => setTimeout(r, 1000 + Math.random() * 500))
                    retryCount++
                }
            }

            if (isLocked) {
                console.log(`[Spinlock] Timed out waiting for lock on Conversation ${conversation.id}. Breaking through.`)
            }

            // 2. Acquire Lock
            await prisma.conversation.update({
                where: { id: conversation.id },
                data: { processingLock: new Date() }
            })

            try {
                // Re-fetch history inside the lock to ensure we have the absolute latest committed messages
                // from other parallel executions that just finished.
                const historyDesc = await prisma.message.findMany({
                    where: { conversationId: conversation.id },
                    orderBy: { timestamp: 'desc' },
                    take: 100
                })
                const history = historyDesc.reverse()

                // ... (History cleaning logic remains same) ...
                const cleanHistory = history.filter((m: any) =>
                    !m.message_text.includes('[Voice Message -') && m.sender !== 'system'
                )

                // Deduplicate Logic (Simplified reuse)
                const uniqueHistory: any[] = []
                if (cleanHistory.length > 0) {
                    uniqueHistory.push(cleanHistory[0])
                    for (let i = 1; i < cleanHistory.length; i++) {
                        const prev = uniqueHistory[uniqueHistory.length - 1]
                        const curr = cleanHistory[i]
                        const isSameSender = prev.sender === curr.sender
                        const isSameText = prev.message_text.trim() === curr.message_text.trim()
                        if (!isSameSender || !isSameText) uniqueHistory.push(curr)
                    }
                }

                const messagesForAI = uniqueHistory.map((m: any) => ({
                    role: m.sender === 'contact' ? 'user' : 'ai',
                    content: m.message_text
                }))

                // Latest message logic
                // Context is everything BEFORE the payload message?
                // Actually with spinlock, we want to answer the *aggregate*.
                // But typically we are answering *this* specific Trigger.
                // However, if we waited, "this" trigger might be old?
                // No, "this" trigger is the one we are processing.
                // But strict sequential means we answer Q1, then Q2.
                // If Q2 comes 10s later, we answer Q2.
                // The issue user described ($12s gap$) means they ARE sequential.
                // The issue was context not updating fast enough or race condition on READ.
                // Locking fixes the race condition on READ.

                const contextMessages = messagesForAI.slice(0, -1)
                const lastMessage = messagesForAI[messagesForAI.length - 1]?.content || messageText

                // ... (Mem0 Logic) ...
                const { memoryService } = require('@/lib/memory')
                let fetchedMemories = []
                try {
                    const searchResults = await memoryService.search(contact.phone_whatsapp, lastMessage)
                    fetchedMemories = Array.isArray(searchResults) ? searchResults : (searchResults?.results || [])
                } catch (e) { console.error('Mem0 error', e) }

                // ... (Director/Prompt Logic) ...
                const { director } = require('@/lib/director')

                // DAILY TRUST CHECK (Instead of per-message)
                // Fire and forget (don't await to block AI response)
                director.performDailyTrustAnalysis(contact.phone_whatsapp).catch((e: any) => console.error("Daily Trust Check Failed", e));

                const { phase, details } = await director.determinePhase(contact.phone_whatsapp)
                let systemPromptWithMemory = director.buildSystemPrompt(settings, contact, phase, details, conversation.prompt.system_prompt)

                // Sentiment trigger removed (moved to daily analysis for stability)

                if (fetchedMemories.length > 0) {
                    systemPromptWithMemory += `\n\n[USER MEMORY]:\n${fetchedMemories.map((m: any) => `- ${m.memory}`).join('\n')}`
                }

                // AI GENERATION & TIMING LOGIC
                // -------------------------------------------------------------
                // 1. Analyze Context for Timing
                // FIX: uniqueHistory is Ascending (Old -> New). .find() gives Oldest. We need Newest.
                const lastUserMsg = [...uniqueHistory].reverse().find((m: any) => m.sender === 'contact')
                const lastUserDate = lastUserMsg ? new Date(lastUserMsg.timestamp) : new Date()

                const timing = TimingManager.analyzeContext(lastUserDate, phase || 'CONNECTION')

                // TEST MODE OVERRIDE: Force Instant Reply
                if (contact.testMode) {
                    console.log(`[Timing] Test Mode Active for ${contact.phone_whatsapp}. Overriding delay to 0s.`)
                    timing.delaySeconds = 0
                    timing.shouldGhost = false
                    timing.mode = 'INSTANT_TEST'
                }

                console.log(`[Timing] Mode: ${timing.mode}, Delay: ${timing.delaySeconds}s, Ghost: ${timing.shouldGhost}`)

                const MAX_INLINE_DELAY = 22 // Vercel limit ~60s, keep safe
                // We MUST use the queue if the delay is longer than what the server allows.
                const useQueue = timing.delaySeconds > MAX_INLINE_DELAY;

                // 2. Queue Logic
                if (useQueue) {
                    console.log(`[Timing] Using Queue (Delay > ${MAX_INLINE_DELAY}s). Generating response now...`)

                    if (timing.shouldGhost) {
                        whatsapp.markAsRead(contact.phone_whatsapp).catch(e => console.error("Failed to mark read", e))
                    }

                    // Generate Response NOW (Pre-generation)
                    const provider = settings.ai_provider || 'venice'
                    let responseText = ""

                    if (provider === 'anthropic') {
                        responseText = await anthropic.chatCompletion(
                            systemPromptWithMemory, contextMessages, lastMessage,
                            { apiKey: settings.anthropic_api_key, model: settings.anthropic_model, temperature: Number(conversation.prompt.temperature), max_tokens: conversation.prompt.max_tokens }
                        )
                    } else {
                        responseText = await venice.chatCompletion(
                            systemPromptWithMemory, contextMessages, lastMessage,
                            { apiKey: settings.venice_api_key, model: conversation.prompt.model, temperature: Number(conversation.prompt.temperature), max_tokens: conversation.prompt.max_tokens }
                        )
                    }
                    // Remove thought bubbles (*...*)
                    responseText = responseText.replace(new RegExp('\\*[^*]+\\*', 'g'), '').trim()

                    // Save to MessageQueue
                    const scheduledAt = new Date(Date.now() + timing.delaySeconds * 1000)
                    await prisma.messageQueue.create({
                        data: {
                            contactId: contact.id,
                            conversationId: conversation.id,
                            content: responseText,
                            scheduledAt: scheduledAt,
                            status: 'PENDING'
                        }
                    })
                    console.log(`[Queue] Message queued for ${scheduledAt.toISOString()}`)

                    return NextResponse.json({ success: true, handler: 'queued', scheduledAt })
                }

                // 3. Inline Logic (Fast Mode)
                console.log(`[Timing] Inline Mode. Waiting ${timing.delaySeconds}s before replying...`)

                // Wait the calculated delay (or part of it if we want to type during it?)
                // Strategy: Wait FIRST, then Generate/Type? 
                // Or Generate, then Wait? 
                // Let's Wait first to simulate "reading/thinking" time before typing starts.
                if (timing.delaySeconds > 0) {
                    await new Promise(r => setTimeout(r, timing.delaySeconds * 1000))
                }

                // MOVED: Mark read later, depending on response type (Stealth Mode)
                // whatsapp.markAsRead(contact.phone_whatsapp).catch(e => { })

                // Generate
                const provider = settings.ai_provider || 'venice'
                let responseText = ""

                if (provider === 'anthropic') {
                    responseText = await anthropic.chatCompletion(
                        systemPromptWithMemory, contextMessages, lastMessage,
                        { apiKey: settings.anthropic_api_key, model: settings.anthropic_model, temperature: Number(conversation.prompt.temperature), max_tokens: conversation.prompt.max_tokens }
                    )
                } else {
                    responseText = await venice.chatCompletion(
                        systemPromptWithMemory, contextMessages, lastMessage,
                        { apiKey: settings.venice_api_key, model: conversation.prompt.model, temperature: Number(conversation.prompt.temperature), max_tokens: conversation.prompt.max_tokens }
                    )
                }

                responseText = responseText.replace(new RegExp('\\*[^*]+\\*', 'g'), '').trim()

                if (responseText && responseText.trim().length > 0) {
                    // SAFETY FILTER
                    const FORBIDDEN_PATTERNS = [
                        'Désolé, une erreur',
                        'Debug:',
                        '{"error":',
                        'Error:',
                        'undefined',
                        'null',
                        'Inference processing failed',
                        '500 -'
                    ];

                    const hasForbidden = FORBIDDEN_PATTERNS.some(p => responseText.includes(p));
                    if (hasForbidden) {
                        console.error(`[Safety] BLOCKED response containing forbidden pattern: "${responseText}"`);
                        return NextResponse.json({ success: true, handler: 'blocked_safety' });
                    }

                    // AUTO-DETECT VOICE INTENT FROM PROMPT (BEFORE SAVING)
                    let isVoiceResponse = settings.voice_response_enabled === 'true' || settings.voice_response_enabled === true
                    let isVoiceMessage = payload.type === 'ptt' || payload.type === 'audio' || payload._data?.mimetype?.startsWith('audio')

                    if (responseText.startsWith('[VOICE]')) {
                        console.log('[Voice] AI explicitly requested Voice Note mode via tag.')
                        isVoiceResponse = true
                        isVoiceMessage = true // Force entry into voice logic
                        responseText = responseText.replace('[VOICE]', '').trim()
                    }

                    // Save AI Response (CLEANED)
                    await prisma.message.create({
                        data: { conversationId: conversation.id, sender: 'ai', message_text: responseText.replace(new RegExp('\\|\\|\\|', 'g'), '\n'), timestamp: new Date() }
                    })

                    // Send (Voice or Text)
                    if (isVoiceResponse && isVoiceMessage) {
                        // Voice Logic: Human-in-the-loop
                        const voiceText = responseText.replace(new RegExp('\\|\\|\\|', 'g'), '. ');
                        const { voiceService } = require('@/lib/voice')

                        // 1. Try to find existing voice
                        const existingClip = await voiceService.findReusableVoice(voiceText)

                        if (existingClip) {
                            console.log(`[Voice] Reusing clip ${existingClip.id} for "${voiceText}"`)
                            // Read receipt NOW because we are sending
                            whatsapp.markAsRead(contact.phone_whatsapp).catch(e => { })
                            await whatsapp.sendVoice(contact.phone_whatsapp, existingClip.url, payload.id)
                            // Mark usage?
                        } else {
                            // 2. Request from Source
                            console.log(`[Voice] No match. Requesting from human source.`)
                            await voiceService.requestVoice(contact.phone_whatsapp, voiceText, lastMessage)

                            // STEALTH MODE: Do NOT send text fallback. Do NOT mark read.
                            // The user will see "Delivered" (Gray Ticks) and nothing else.
                            // We wait for ingestion.
                            return NextResponse.json({ success: true, handler: 'voice_requested_stealth' })
                        }
                    } else {
                        // Text Logic -> Standard Flow (Mark Read -> Type -> Send)
                        whatsapp.markAsRead(contact.phone_whatsapp).catch(e => { })

                        let parts = responseText.split('|||').filter(p => p.trim().length > 0)
                        if (parts.length === 1 && responseText.length > 50) {
                            const paragraphs = responseText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
                            if (paragraphs.length > 1) parts = paragraphs;
                        }

                        for (const part of parts) {
                            const cleanPart = part.trim()
                            await whatsapp.sendTypingState(contact.phone_whatsapp, true).catch(e => { })
                            const typingMs = Math.min(cleanPart.length * 30, 8000)
                            await new Promise(r => setTimeout(r, typingMs))
                            const quoteId = (parts.indexOf(part) === 0) ? payload.id : undefined
                            await whatsapp.sendText(contact.phone_whatsapp, cleanPart, quoteId)
                            if (parts.indexOf(part) < parts.length - 1) {
                                await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000))
                            }
                        }
                    }
                } else {
                    console.error('[AI] Empty response received. Ghosting user to allow retry later.');
                }

            } finally {
                // 3. Release Lock
                await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: { processingLock: null }
                })
            }
        } // End if (conversation.ai_enabled)

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Webhook Error Full Stack:', error)
        console.error('Webhook Error Message:', error.message)
        // If Prisma Error
        if (error.code) {
            console.error('Prisma Error Code:', error.code)
            console.error('Prisma Meta:', error.meta)
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
