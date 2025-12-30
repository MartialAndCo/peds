import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { anthropic } from '@/lib/anthropic'
import { whatsapp } from '@/lib/whatsapp'
import { TimingManager } from '@/lib/timing'

export async function POST(req: Request) {
    console.error('🔹 Webhook POST received [Build: 2025-12-30_19-00-ERROR-LOGS]')
    try {
        const body = await req.json()
        console.error('🔹 Webhook Body:', JSON.stringify(body, null, 2))
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

        let from = payload.from // e.g. 33612345678@c.us or @s.whatsapp.net

        // Normalize if coming from raw Baileys
        if (from.includes('@s.whatsapp.net')) {
            from = from.replace('@s.whatsapp.net', '@c.us')
        }

        if (!from.includes('@c.us')) {
            // Group (g.us) or status (broadcast), ignore
            console.log(`[Webhook] Ignored JID: ${from}`)
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

        // Check if sender is privileged (Strict Equality to avoid partial matches)
        // Normalize admin phones by removing '+' for comparison if normalizedPhone has it?
        // normalizedPhone = "+33..."
        // adminPhone might be "+33..." or "33..."
        // Let's stripping '+' from both for comparison.
        const cleanSender = normalizedPhone.replace('+', '')

        const isPrivilegedSender =
            (adminPhone && cleanSender === adminPhone.replace('+', '')) ||
            (mediaSourcePhone && cleanSender === mediaSourcePhone.replace('+', '')) ||
            (voiceSourcePhone && cleanSender === voiceSourcePhone.replace('+', '')) ||
            (leadProviderPhone && cleanSender === leadProviderPhone.replace('+', ''))

        console.error(`[Webhook] Sender: ${normalizedPhone} (Clean: ${cleanSender})`)
        console.error(`[Webhook] AdminPhone: ${adminPhone}, MediaSource: ${mediaSourcePhone}, LeadProvider: ${leadProviderPhone}`)
        console.error(`[Webhook] IsPrivileged: ${isPrivilegedSender}`)

        if (isPrivilegedSender) {
            console.error(`[Webhook] Privileged message from ${normalizedPhone}`)
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

        // 3. Delegate to Chat Handler (Includes: ViewOnce, Voice/Vision, Debounce, Spinlock, AI)
        const { handleChat } = require('@/lib/handlers/chat')
        const chatResult = await handleChat(payload, contact, conversation, settings, messageText)

        console.log(`[Webhook] Chat Result: ${chatResult.result}`)
        return NextResponse.json({ success: true, handler: chatResult.result })


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
