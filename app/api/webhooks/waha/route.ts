import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { anthropic } from '@/lib/anthropic'
import { waha } from '@/lib/waha'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        // Event structure: { event: 'message', payload: { ... }, session: 'default' }

        if (body.event !== 'message') {
            // Ignore other events for now (ack, status, etc.)
            return NextResponse.json({ success: true, ignored: true })
        }

        const payload = body.payload
        // Payload: { id: '...', from: '...', body: '...', ... }

        // Ignore messages from me (if WAHA echoes them)
        // payload.fromMe is usually true for own messages
        if (payload.fromMe) {
            return NextResponse.json({ success: true, ignored: true })
        }

        const from = payload.from // e.g., 33612345678@c.us
        // Extract phone number assuming format @c.us
        if (!from.includes('@c.us')) {
            // Group message or status broadcast? Ignore.
            return NextResponse.json({ success: true, ignored: true })
        }

        const phone_whatsapp = from.split('@')[0] // 33612345678 (without + usually in WAHA payload, check docs/logs)
        // Wait, WAHA payload 'from' usually matches what is needed to reply. 
        // Our DB stores specific format. Spec says: "Format international obligatoire : +33612345678"
        // WAHA 'from' might be '33612345678@c.us'. 
        // We should normalize. 
        // Let's assume DB stores '+33612345678' or '33612345678'. 
        // In creation endpoint we removed spaces. 
        // Let's try to match by 'contains' or flexible logic.
        // Or just +phone if missing?

        // Simplest: store without + in DB or handle both.
        // Let's try to find contact by phone (fuzzy).

        let contact = await prisma.contact.findFirst({
            where: {
                phone_whatsapp: {
                    // Try exact match or with/without +
                    in: [phone_whatsapp, `+${phone_whatsapp}`]
                }
            }
        })

        if (!contact) {
            // Auto-create contact? Spec says "Si aucune conversation active -> ignorer ou créer auto"
            // Let's create contact auto for MVP to capture leads.
            const name = payload._data?.notifyName || "Inconnu"
            contact = await prisma.contact.create({
                data: {
                    phone_whatsapp: `+${phone_whatsapp}`, // Standardize with +
                    name: name,
                    source: 'WhatsApp Incoming',
                    status: 'new'
                }
            })
        }

        // Find active conversation
        let conversation = await prisma.conversation.findFirst({
            where: {
                contactId: contact.id,
                status: 'active'
            },
            include: { prompt: true }
        })

        if (!conversation) {
            // Option: Ignorer si pas de conversation? ou créer?
            // Spec 8.3 "Si webhook... logger + ignorer (ou créer auto selon choix)"
            // Let's create auto-conversation if contact sends message, using a DEFAULT prompt?
            // We need a prompt. Find first prompt available.
            const defaultPrompt = await prisma.prompt.findFirst()
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
                console.log('No prompt found, cannot start conversation')
                return NextResponse.json({ success: true, error: 'No prompt' })
            }
        }

        // Check for Media (Voice/Audio)
        let messageText = payload.body
        const isVoiceMessage = payload._data?.mimetype?.startsWith('audio') || payload.type === 'ptt' || payload.type === 'audio'

        if (isVoiceMessage) {
            console.log('Voice Message Detected. Attempting Transcription...')
            try {
                // Fetch Settings for API Key
                const settingsList = await prisma.setting.findMany()
                const settings = settingsList.reduce((acc: any, curr: any) => {
                    acc[curr.key] = curr.value
                    return acc
                }, {} as Record<string, string>)

                const apiKey = settings.elevenlabs_api_key
                if (apiKey) {
                    const media = await waha.downloadMedia(payload.id, payload.from)
                    if (media && media.data) {
                        const { elevenlabs } = require('@/lib/elevenlabs')
                        const transcript = await elevenlabs.transcribeAudio(media.data, { apiKey })
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
                    console.warn('No ElevenLabs API Key found for transcription.')
                    messageText = "[Voice Message - Transcription Disabled]"
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
                waha_message_id: payload.id,
                timestamp: new Date()
            }
        })

        // Logic AI
        if (conversation.ai_enabled) {
            // Fetch history
            const history = await prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { timestamp: 'asc' },
                take: 20 // Context window
            })

            // Convert db messages to AI format
            const messagesForAI = history.map((m: any) => ({
                role: m.sender === 'contact' ? 'user' : 'ai', // admin or ai -> assistant? 
                // Better: 'contact' -> 'user', 'ai'/'admin' -> 'assistant'
                content: m.message_text
            }))

            // Call Venice
            const aiResponse = await venice.chatCompletion(
                conversation.prompt.system_prompt,
                messagesForAI, // History already includes the new message we just saved?
                // Wait, history INCLUDES the just saved message (contact).
                // venice.chatCompletion signature: (system, messages, userMessage)
                // If messagesForAI ALREADY contains the last user message, we might double it if we pass it as 3rd arg?
                // Let's adjust usage.
                // We pass history EXCLUDING the last one as context, and last one as userMessage?
                // Or just pass empty userMessage and let history handle it?
                // Let's fix lib usage in next iteration or logic here.
                // venice.ts: `apiMessages` constructs [...history, { role: 'user', content: userMessage }]
                // If we include all history, we should pass empty string or refactor lib.
                // Let's Refactor logic here to pass last message separately?
                // Actually, simplest is: exclude last message from history array passed to lib.

                // Or better: Let's assume history has ALL.
                // We'll modify lib call to be more flexible? No, let's look at `lib/venice.ts`.
                // It TAKES `userMessage` and appends it.
                // So we should NOT include the current message in `messages` array passed to it.
                "", // Empty user message not ideal if lib enforces it.
                // Let's pass the payload body as userMessage, and history (minus last) as context.
                {
                    model: conversation.prompt.model,
                    temperature: Number(conversation.prompt.temperature),
                    max_tokens: conversation.prompt.max_tokens
                }
            )

            // Correction: history (taken from DB) INCLUDES the fresh insert.
            // We should slice it.
            const contextMessages = messagesForAI.slice(0, -1)
            const lastMessage = messagesForAI[messagesForAI.length - 1].content

            // Fetch global settings to see active provider
            const settingsList = await prisma.setting.findMany()
            const settings = settingsList.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value
                return acc
            }, {} as Record<string, string>)

            const provider = settings.ai_provider || 'venice'
            let responseText = ""

            if (provider === 'anthropic') {
                // Determine model: prompt model > settings model > default
                let model = conversation.prompt.model || settings.anthropic_model || 'claude-3-haiku-20240307'

                // Safety check: if model is 'venice-uncensored' (default for new prompts) but we are using Anthropic, switch.
                if (model === 'venice-uncensored' || !model.startsWith('claude')) {
                    model = settings.anthropic_model || 'claude-3-haiku-20240307'
                }

                responseText = await anthropic.chatCompletion(
                    conversation.prompt.system_prompt,
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
                // Venice
                responseText = await venice.chatCompletion(
                    conversation.prompt.system_prompt,
                    contextMessages, // previous context
                    lastMessage,     // current trigger
                    {
                        apiKey: settings.venice_api_key, // Pass from settings
                        model: conversation.prompt.model,
                        temperature: Number(conversation.prompt.temperature),
                        max_tokens: conversation.prompt.max_tokens
                    }
                )
            }

            // Save AI Response
            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    sender: 'ai',
                    message_text: responseText,
                    timestamp: new Date()
                }
            })

            // Send via WAHA with Safe Bot practices or Voice
            const isVoiceResponse = settings.voice_response_enabled === 'true' || settings.voice_response_enabled === true
            const isIncomingVoice = payload._data?.mimetype?.startsWith('audio') || payload.type === 'ptt' || payload.type === 'audio'

            if (isVoiceResponse && isIncomingVoice) {
                try {
                    // 1. Generate Audio from AI text
                    // Note: We need ElevenLabs API Key from settings
                    const elevenLabsApiKey = settings.elevenlabs_api_key
                    const elevenLabsVoiceId = settings.elevenlabs_voice_id

                    // Dynamically import to avoid circular dep if any, or just use imported
                    const { elevenlabs } = require('@/lib/elevenlabs')

                    const audioDataUrl = await elevenlabs.generateAudio(responseText, {
                        apiKey: elevenLabsApiKey,
                        voiceId: elevenLabsVoiceId
                    })

                    // 2. Send Voice
                    await waha.sendVoice(contact.phone_whatsapp, audioDataUrl)
                } catch (voiceError) {
                    console.error('Voice Generation Failed, falling back to text:', voiceError)
                    await waha.sendSafeReply(contact.phone_whatsapp, responseText)
                }
            } else {
                await waha.sendSafeReply(contact.phone_whatsapp, responseText)
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Webhook Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
