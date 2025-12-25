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

        // --- 1. Source (Admin) Logic ---
        const sourcePhone = settings.source_phone_number
        if (sourcePhone && normalizedPhone === sourcePhone) {
            console.log('Message from Source (Admin).')

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

        // Detect Intent
        let messageText = payload.body
        // If it's voice, we transcribe later. If it's text:
        if (payload.type === 'chat') {
            const detectedIntent = await mediaService.detectIntent(messageText)

            if (detectedIntent) {
                console.log(`Media Intent Detected: ${detectedIntent.id}`)
                const result = await mediaService.processRequest(contact.phone_whatsapp, detectedIntent.id)

                if (result.action === 'SEND') {
                    console.log('Media found in bank. Sending...')
                    // Assuming result.media.url is Data URL
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

                    // Mem0 Log
                    const { memoryService } = require('@/lib/memory')
                    await memoryService.add(contact.phone_whatsapp, messageText) // User Request
                    await memoryService.add(contact.phone_whatsapp, `[System]: Sent media ${detectedIntent.id}`)

                    return NextResponse.json({ success: true, handler: 'media_sent' })

                } else if (result.action === 'REQUEST_SOURCE') {
                    console.log('No media in bank. Requesting from Source...')
                    const sentToSource = await mediaService.requestFromSource(contact.phone_whatsapp, detectedIntent.id)

                    if (sentToSource) {
                        await whatsapp.sendText(contact.phone_whatsapp, "Laisse-moi une seconde... 😊") // "Let me check..."
                    } else {
                        // Fallback if no source configured
                        await whatsapp.sendText(contact.phone_whatsapp, "Désolé, je ne peux pas faire ça pour le moment.")
                    }

                    return NextResponse.json({ success: true, handler: 'media_request_pending' })
                }
            }
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

            // Mem0: Prepare System Prompt with Context
            let systemPromptWithMemory = conversation.prompt.system_prompt
            if (fetchedMemories.length > 0) {
                const memoriesText = fetchedMemories.map((m: any) => `- ${m.memory}`).join('\n')
                systemPromptWithMemory += `\n\n[USER MEMORY / CONTEXT]:\n${memoriesText}\n\n[INSTRUCTION]: Use the above memory to personalize the response.`
                console.log('Injected Memories:', memoriesText)
            }

            // Settings already fetched

            const provider = settings.ai_provider || 'venice'
            let responseText = ""

            if (provider === 'anthropic') {
                let model = conversation.prompt.model || settings.anthropic_model || 'claude-3-haiku-20240307'
                if (model === 'venice-uncensored' || !model.startsWith('claude')) {
                    model = settings.anthropic_model || 'claude-3-haiku-20240307'
                }
                responseText = await anthropic.chatCompletion(
                    systemPromptWithMemory, // Use augmented prompt
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
                    systemPromptWithMemory, // Use augmented prompt
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
                await memoryService.add(contact.phone_whatsapp, responseText)
                console.log('Memories stored for', contact.phone_whatsapp)
            } catch (saveError) {
                console.error('Mem0 Save Failed:', saveError)
            }

            // Save AI Response to DB
            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    sender: 'ai',
                    message_text: responseText,
                    timestamp: new Date()
                }
            })

            // Send via WhatsApp Service
            const isVoiceResponse = settings.voice_response_enabled === 'true' || settings.voice_response_enabled === true
            const isIncomingVoice = isVoiceMessage // Use boolean calculated earlier

            if (isVoiceResponse && isIncomingVoice) {
                try {
                    let audioDataUrl: string

                    if (settings.cartesia_api_key) {
                        const { cartesia } = require('@/lib/cartesia')
                        audioDataUrl = await cartesia.generateAudio(responseText, {
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
                await whatsapp.sendText(contact.phone_whatsapp, responseText)
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
