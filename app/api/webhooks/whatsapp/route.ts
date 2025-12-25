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
                // Cancel logic would go here (need to find pending request)
                const pending = await prisma.pendingRequest.findFirst({ where: { status: 'pending' } })
                if (pending) {
                    // Update DB
                    await prisma.pendingRequest.update({ where: { id: pending.id }, data: { status: 'cancelled' } })
                    await whatsapp.sendText(sourcePhone, "✅ Demande annulée.")
                    // Optionally notify contact via AI?
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
            const analysis = await mediaService.analyzeRequest(messageText)

            if (analysis && analysis.isMediaRequest) {
                if (!analysis.allowed) {
                    console.log(`Media Request Blocked: ${analysis.refusalReason}`)
                    await whatsapp.sendText(contact.phone_whatsapp, analysis.refusalReason || "Je ne peux pas envoyer ce type de contenu.")
                    return NextResponse.json({ success: true, handler: 'media_blocked' })
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
            // If not isMediaRequest, fall through to conversational AI
        }


        // Find/Create Conversation (Standard Flow continuation)
        // We can't easily upsert conversation because logic depends on status='active'
        // But we can optimize finding it.
        let conversation = await prisma.conversation.findFirst({
            where: {
                contactId: contact.id,
                status: 'active'
            },
            include: { prompt: true }
        })

        if (!conversation) {
            const defaultPrompt = await prisma.prompt.findFirst({
                where: { isActive: true } // Prefer active prompt!
            }) || await prisma.prompt.findFirst() // Fallback to any

            if (defaultPrompt) {
                conversation = await prisma.conversation.create({
                    data: {
                        contactId: contact.id,
                        promptId: defaultPrompt.id,
                        status: 'active',
                        ai_enabled: true
                    },
                    include: { prompt: true }
                })
            } else {
                console.error('No prompt found, cannot start conversation')
                // Return 2000 to avoid retries from WhatsApp service if it's a permanent config error
                return NextResponse.json({ success: false, error: 'No prompt configured' })
            }
        }

        // Handle Content (Voice handling...)
        const isVoiceMessage = payload.type === 'ptt' || payload.type === 'audio' || payload._data?.mimetype?.startsWith('audio')

        if (isVoiceMessage) {
            console.log('Voice Message Detected. Attempting Transcription via Cartesia...')
            try {
                // Settings already fetched above
                const apiKey = settings.cartesia_api_key
                if (apiKey) {
                    // Use whatsapp client download
                    const media = await whatsapp.downloadMedia(payload.id)
                    if (media && media.data) {
                        const { cartesia } = require('@/lib/cartesia')
                        // media.data is already a Buffer from lib/whatsapp.ts
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

        // Save User Message
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'contact',
                message_text: messageText,
                waha_message_id: payload.id, // we might store 'false_...' here
                timestamp: new Date()
            }
        })

        // Safety: If voice failed, do NOT trigger AI (prevents loops)
        if (messageText.startsWith('[Voice Message -')) {
            console.log("Voice processing failed or disabled, skipping AI.")
            await whatsapp.sendText(contact.phone_whatsapp, "Désolé, je ne peux pas écouter les messages vocaux pour le moment.")
            return NextResponse.json({ success: true })
        }

        // Logic AI
        if (conversation.ai_enabled) {
            const history = await prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { timestamp: 'asc' },
                take: 20
            })

            // Clean History for AI Context
            // 1. Remove "Download Failed" system messages
            const cleanHistory = history.filter((m: any) =>
                !m.message_text.includes('[Voice Message -')
            )

            // 2. Deduplicate consecutive identical messages from the same role
            // This prevents the "Loop" effect where the AI sees its own previous repetitive answer and repeats it.
            const uniqueHistory: any[] = []
            cleanHistory.forEach((m: any, index: number) => {
                const prev = uniqueHistory[uniqueHistory.length - 1]
                if (prev && prev.sender === m.sender && prev.message_text === m.message_text) {
                    return // Skip duplicate
                }
                uniqueHistory.push(m)
            })

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

            // 1. Update Trust (Fire & Forget)
            director.updateTrustScore(contact.phone_whatsapp, lastMessage).catch((e: any) => console.error("Trust Update Failed:", e))

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
                        max_tokens: conversation.prompt.max_tokens
                    }
                )
            }

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
                const parts = responseText.split('|||').filter(p => p.trim().length > 0)

                for (const part of parts) {
                    const cleanPart = part.trim()

                    // 1. Initial Delay (Reading/Thinking) - only for first part? 
                    // Or small pause for subsequent parts.
                    if (parts.indexOf(part) === 0) {
                        const preTypingDelay = Math.floor(Math.random() * 2000) + 1000
                        await new Promise(r => setTimeout(r, preTypingDelay))

                        await whatsapp.markAsRead(contact.phone_whatsapp)
                    } else {
                        // Small pause before typing next part
                        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000))
                    }

                    // 2. Start Typing
                    await whatsapp.sendTypingState(contact.phone_whatsapp, true)

                    // 3. Typing Duration
                    const charDelay = 40 + Math.random() * 20 // Slightly faster
                    const typingDuration = Math.min(cleanPart.length * charDelay, 12000)

                    await new Promise(r => setTimeout(r, typingDuration))

                    // 4. Send
                    await whatsapp.sendText(contact.phone_whatsapp, cleanPart)
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
