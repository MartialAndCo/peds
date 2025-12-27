import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { anthropic } from '@/lib/anthropic'
import { whatsapp } from '@/lib/whatsapp'

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
        const sourcePhone = settings.source_phone_number
        if (sourcePhone && normalizedPhone === sourcePhone) {
            console.log('Message from Source (Admin).')
            const text = messageText

            // B. Check for Commands
            if (text.toUpperCase().includes('[PROBLEM]')) {
                const problemDesc = text.replace(/\[PROBLEM\]/i, '').trim()
                // Notify Super Admin (using same source phone for now or logging, user requested forwarding)
                // Assuming User == Source for now, or just Ack.
                // Or send to a specific admin number if we had one.
                await whatsapp.sendText(sourcePhone, `✅ Problème signalé: "${problemDesc}". (Note: Forwarding not configured yet)`)
                return NextResponse.json({ success: true, handler: 'source_problem' })
            }
            if (text.toUpperCase().includes('[CANCEL]') || text.toUpperCase().includes('[ANNULER]')) {
                const reason = text.replace(/\[CANCEL\]|\[ANNULER\]/i, '').trim()

                const pending = await prisma.pendingRequest.findFirst({ where: { status: 'pending' } })
                if (pending) {
                    await prisma.pendingRequest.update({ where: { id: pending.id }, data: { status: 'cancelled' } })
                    await whatsapp.sendText(sourcePhone, `✅ Demande annulée.${reason ? ' Contact informé.' : ''}`)

                    // Notify Contact via AI if reason provided
                    if (reason) {
                        const contactPhone = pending.requesterPhone
                        // Context loading...
                        let currentConversation = await prisma.conversation.findFirst({
                            where: { contactId: (await prisma.contact.findUnique({ where: { phone_whatsapp: contactPhone } }))?.id, status: 'active' },
                            include: { prompt: true }
                        })

                        const systemMsg = `(SYSTEM: You previously promised a photo/video, but you realize you cannot send it. Reason provided by your life context: "${reason}". 
INSTRUCTION: Apologize to the user naturally and explain why you can't right now (using the reason as inspiration, but keep it casual/human). Do NOT say 'Admin cancelled'. Say 'I realized...', 'I forgot...', etc.)`

                        // We use the same AI flow but with this specific prompt
                        // Short-circuit: just call AI here
                        const provider = settings.ai_provider || 'venice'
                        let aiReply = ""
                        if (provider === 'anthropic') {
                            aiReply = await anthropic.chatCompletion(currentConversation?.prompt?.system_prompt || "You are a friend.", [], systemMsg, { apiKey: settings.anthropic_api_key, model: settings.anthropic_model })
                        } else {
                            aiReply = await venice.chatCompletion(currentConversation?.prompt?.system_prompt || "You are a friend.", [], systemMsg, { apiKey: settings.venice_api_key, model: settings.venice_model })
                        }

                        await whatsapp.sendText(contactPhone, aiReply)
                        // Store in DB
                        if (currentConversation) {
                            await prisma.message.create({ data: { conversationId: currentConversation.id, sender: 'ai', message_text: aiReply, timestamp: new Date() } })
                        }
                    }

                } else {
                    await whatsapp.sendText(sourcePhone, "⚠️ Aucune demande en attente à annuler.")
                }
                return NextResponse.json({ success: true, handler: 'source_cancel' })
            }

            // If Media -> Ingest
            const isMedia = payload.type === 'image' || payload.type === 'video'
            if (isMedia) {
                console.log('Source sent media. Ingesting...')
                const media = await whatsapp.downloadMedia(payload.id)
                if (media && media.data) {
                    const { mediaService } = require('@/lib/media')
                    const mimeType = payload._data?.mimetype || (payload.type === 'image' ? 'image/jpeg' : 'video/mp4')
                    // media.data is base64 string (from whatsapp-web.js MessageMedia.data)
                    const ingestionResult = await mediaService.ingestMedia(sourcePhone, `data:${mimeType};base64,${media.data}`, mimeType)

                    if (ingestionResult) {
                        await whatsapp.sendText(sourcePhone, `✅ Media ingested for ${ingestionResult.type}. Sent to ${ingestionResult.sentTo}.`)
                    } else {
                        await whatsapp.sendText(sourcePhone, `✅ Media stored (Uncategorized or no pending request).`)
                    }
                    return NextResponse.json({ success: true, handler: 'source_media' })
                }
            }
            // If text -> assume normal admin usage or command (ignored for now or let fall through to AI? Admin probably doesn't want AI to reply to them usually)
            return NextResponse.json({ success: true, ignored: true, reason: 'admin_text' })
        }

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

        if (!conversation) {
            const defaultPrompt = await prisma.prompt.findFirst({ where: { isActive: true } }) || await prisma.prompt.findFirst()
            if (!defaultPrompt) return NextResponse.json({ error: 'No prompt configured' }, { status: 500 })

            // Create Conversation (PAUSED BY DEFAULT for Cold Start)
            conversation = await prisma.conversation.create({
                data: {
                    contactId: contact.id,
                    promptId: defaultPrompt.id,
                    status: 'paused', // <--- COLD START (Paused for context)
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

        // Voice Transcription Logic (Moved BEFORE saving message so we save the transcribed text)
        const isVoiceMessage = payload.type === 'ptt' || payload.type === 'audio' || payload._data?.mimetype?.startsWith('audio')

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

        // Logic AI
        if (conversation.ai_enabled) {
            const historyDesc = await prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { timestamp: 'desc' },
                take: 20
            })
            // Reverse to get chronological order (Oldest -> Newest) for AI context
            const history = historyDesc.reverse()

            // Clean History for AI Context
            // 1. Remove "Download Failed" system messages and internal system markers
            const cleanHistory = history.filter((m: any) =>
                !m.message_text.includes('[Voice Message -') && m.sender !== 'system'
            )

            // 2. Deduplicate: Remove sequential duplicates (User X -> User X with same text)
            // Fix: The previous logic was complex. Let's simplify.
            // If message[i] == message[i-1], skip it.
            const uniqueHistory: any[] = []
            if (cleanHistory.length > 0) {
                uniqueHistory.push(cleanHistory[0])
                for (let i = 1; i < cleanHistory.length; i++) {
                    const prev = uniqueHistory[uniqueHistory.length - 1]
                    const curr = cleanHistory[i]

                    // Duplicate Criteria: Same Sender AND (Same Text OR Text Include)
                    // If strict duplicate, skip.
                    const isSameSender = prev.sender === curr.sender
                    const isSameText = prev.message_text.trim() === curr.message_text.trim()

                    if (!isSameSender || !isSameText) {
                        uniqueHistory.push(curr)
                    } else {
                        console.log(`[AI Context] Skipping duplicate history message: "${curr.message_text.substring(0, 20)}..."`)
                    }
                }
            }

            const messagesForAI = uniqueHistory.map((m: any) => ({
                role: m.sender === 'contact' ? 'user' : 'ai',
                content: m.message_text
            }))

            // Prepare Context (excluding last message if it's the current one we are processing)
            // Wait, "history" query only fetches *saved* messages.
            // In line 118 we saved the CURRENT message.
            // So messagesForAI includes the current message at the end.

            const contextMessages = messagesForAI.slice(0, -1)
            const lastMessage = messagesForAI[messagesForAI.length - 1].content

            // Mem0: Retrieve Context
            const { memoryService } = require('@/lib/memory')
            let fetchedMemories = []
            try {
                // Search for relevant memories based on the last user message
                const searchResults = await memoryService.search(contact.phone_whatsapp, lastMessage)
                // searchResults structure depends on Mem0, typically .results or direct array. Assuming direct array or .results.
                fetchedMemories = Array.isArray(searchResults) ? searchResults : (searchResults?.results || [])
            } catch (memError) {
                console.error('Mem0 Search Failed:', memError)
            }

            // --- STATE-AWARE AGENT LOGIC ---
            const { director } = require('@/lib/director')

            // 1. Update Trust & Analyze Sentiment
            const { sentiment } = await director.updateTrustScore(contact.phone_whatsapp, lastMessage).catch((e: any) => ({ sentiment: 'NEUTRAL' }))

            // 2. Get Phase & Context
            const { phase, details } = await director.determinePhase(contact.phone_whatsapp)

            // 3. Construct Modular Prompt (User Template via Settings)
            let systemPromptWithMemory = director.buildSystemPrompt(
                settings,
                contact,
                phase,
                details,
                conversation.prompt.system_prompt
            )

            // Sentiment Reaction
            if (sentiment === 'BAD') {
                systemPromptWithMemory += `\n\n[SENTIMENT TRIGGER]: The user's last message was classified as BAD (Aggressive/Creepy). \n[INSTRUCTION]: BE COLD. Drop the cheerful tone. Be defensive, short, and dry. Do NOT be nice.`
            }

            // Mem0 Context Injection
            if (fetchedMemories.length > 0) {
                const memoriesText = fetchedMemories.map((m: any) => `- ${m.memory}`).join('\n')
                systemPromptWithMemory += `\n\n[USER MEMORY / CONTEXT]:\n${memoriesText}\n\n[INSTRUCTION]: Use the above memory to personalize the response.`
            }


            const provider = settings.ai_provider || 'venice'
            let responseText = ""

            if (provider === 'anthropic') {
                let model = conversation.prompt.model || settings.anthropic_model || 'claude-3-haiku-20240307'
                if (model === 'venice-uncensored' || !model.startsWith('claude')) {
                    model = settings.anthropic_model || 'claude-3-haiku-20240307'
                }
                responseText = await anthropic.chatCompletion(
                    systemPromptWithMemory,
                    contextMessages,
                    lastMessage,
                    {
                        apiKey: settings.anthropic_api_key,
                        model: model,
                        temperature: Number(conversation.prompt.temperature),
                        max_tokens: conversation.prompt.max_tokens
                    }
                )
            } else {
                responseText = await venice.chatCompletion(
                    systemPromptWithMemory,
                    contextMessages,
                    lastMessage,
                    {
                        apiKey: settings.venice_api_key,
                        model: conversation.prompt.model,
                        temperature: Number(conversation.prompt.temperature),
                        max_tokens: conversation.prompt.max_tokens,
                        frequency_penalty: 0.5
                    }
                )
            }

            // --- GUARDRAIL: STRIP ASTERISKS ---
            // Remove *sighs*, *laughs*, etc.
            responseText = responseText.replace(/\*[^*]+\*/g, '').trim()

            // Mem0: Store Interaction Async
            try {
                // Store User Message
                await memoryService.add(contact.phone_whatsapp, lastMessage)
                // Store AI Response (optional, but good for context loop)
                await memoryService.add(contact.phone_whatsapp, responseText.replace(/\|\|\|/g, '\n'))
                console.log('Memories stored for', contact.phone_whatsapp)
            } catch (saveError) {
                console.error('Mem0 Save Failed:', saveError)
            }

            // Save AI Response to DB
            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    sender: 'ai',
                    message_text: responseText.replace(/\|\|\|/g, '\n'),
                    timestamp: new Date()
                }
            })

            // Send via WhatsApp Service
            const isVoiceResponse = settings.voice_response_enabled === 'true' || settings.voice_response_enabled === true
            const isIncomingVoice = isVoiceMessage // Use boolean calculated earlier

            if (isVoiceResponse && isIncomingVoice) {
                try {
                    let audioDataUrl: string
                    // Note: We might want to remove ||| from voice text too or split audio? 
                    // For simplicity, just replace with space for voice.
                    const voiceText = responseText.replace(/\|\|\|/g, '. ');

                    if (settings.cartesia_api_key) {
                        const { cartesia } = require('@/lib/cartesia')
                        audioDataUrl = await cartesia.generateAudio(voiceText, {
                            apiKey: settings.cartesia_api_key,
                            voiceId: settings.cartesia_voice_id,
                            modelId: settings.cartesia_model_id
                        })

                        // Send Voice via new client
                        await whatsapp.sendVoice(contact.phone_whatsapp, audioDataUrl)
                    } else {
                        throw new Error('No Voice Provider configured (Cartesia Key missing)')
                    }

                } catch (voiceError: any) {
                    console.error('Voice Generation/Send Failed, fallback to text:', voiceError)
                    await whatsapp.sendText(contact.phone_whatsapp, responseText)
                }
            } else {
                // SPLIT MESSAGE SENDING LOGIC
                let parts = responseText.split('|||').filter(p => p.trim().length > 0)

                // Fallback: If AI didn't use ||| but message has multiple paragraphs/sentences, split intelligently
                if (parts.length === 1 && responseText.length > 50) {
                    // Split on double newlines first (paragraphs)
                    const paragraphs = responseText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
                    if (paragraphs.length > 1) {
                        parts = paragraphs;
                    } else {
                        // Optional: Split by sentences if very long? 
                        // For now, let's stick to newlines to avoid breaking mid-sentence which looks robotic if timed poorly.
                        // But often AI sends "Haha yeah\n\nQuestion?" -> split that.
                        // Also single newlines?
                        const lines = responseText.split('\n').filter(p => p.trim().length > 0);
                        if (lines.length > 1) {
                            parts = lines;
                        }
                    }
                }

                try {
                    for (const part of parts) {
                        const cleanPart = part.trim()

                        // 1. Initial Delay
                        if (parts.indexOf(part) === 0) {
                            const preTypingDelay = Math.floor(Math.random() * 2000) + 1000
                            await new Promise(r => setTimeout(r, preTypingDelay))
                            await whatsapp.markAsRead(contact.phone_whatsapp).catch(e => console.warn('MarkRead failed', e.message))
                        } else {
                            await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000))
                        }

                        // 2. Start Typing
                        await whatsapp.sendTypingState(contact.phone_whatsapp, true).catch(e => console.warn('Typing failed', e.message))

                        // 3. Typing Duration
                        const charDelay = 40 + Math.random() * 20
                        const typingDuration = Math.min(cleanPart.length * charDelay, 12000)
                        await new Promise(r => setTimeout(r, typingDuration))

                        // 4. Send
                        await whatsapp.sendText(contact.phone_whatsapp, cleanPart)
                    }
                } catch (sendError: any) {
                    console.error('WhatsApp Send Failed (Service likely down or unreachable):', sendError.message)
                    // Swallow error to preserve AI response in DB
                }
            }
        }

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
