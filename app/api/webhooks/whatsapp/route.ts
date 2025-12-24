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

        // Find/Create Conversation
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

        // Handle Content
        let messageText = payload.body
        const isVoiceMessage = payload.type === 'ptt' || payload.type === 'audio' || payload._data?.mimetype?.startsWith('audio')

        if (isVoiceMessage) {
            console.log('Voice Message Detected. Attempting Transcription...')
            try {
                const settingsList = await prisma.setting.findMany()
                const settings = settingsList.reduce((acc: any, curr: any) => {
                    acc[curr.key] = curr.value
                    return acc
                }, {})

                const apiKey = settings.elevenlabs_api_key
                if (apiKey) {
                    // Use new whatsapp client download
                    const media = await whatsapp.downloadMedia(payload.id)
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
                waha_message_id: payload.id, // we might store 'false_...' here
                timestamp: new Date()
            }
        })

        // Logic AI
        if (conversation.ai_enabled) {
            const history = await prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { timestamp: 'asc' },
                take: 20
            })

            const messagesForAI = history.map((m: any) => ({
                role: m.sender === 'contact' ? 'user' : 'ai',
                content: m.message_text
            }))

            // Prepare Context (excluding last message which is the trigger)
            const contextMessages = messagesForAI.slice(0, -1)
            const lastMessage = messagesForAI[messagesForAI.length - 1].content

            const settingsList = await prisma.setting.findMany()
            const settings = settingsList.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value
                return acc
            }, {})

            const provider = settings.ai_provider || 'venice'
            let responseText = ""

            if (provider === 'anthropic') {
                let model = conversation.prompt.model || settings.anthropic_model || 'claude-3-haiku-20240307'
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
                responseText = await venice.chatCompletion(
                    conversation.prompt.system_prompt,
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

            // Save AI Response
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
                    const elevenLabsApiKey = settings.elevenlabs_api_key
                    const elevenLabsVoiceId = settings.elevenlabs_voice_id

                    const { elevenlabs } = require('@/lib/elevenlabs')
                    const audioDataUrl = await elevenlabs.generateAudio(responseText, {
                        apiKey: elevenLabsApiKey,
                        voiceId: elevenLabsVoiceId
                    })

                    // Send Voice via new client
                    await whatsapp.sendVoice(contact.phone_whatsapp, audioDataUrl)
                } catch (voiceError) {
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
