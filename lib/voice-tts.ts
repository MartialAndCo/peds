// lib/voice-tts.ts
// Direct TTS service - bypasses human, uses Qwen TTS with LLM preprocessing

import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { qwenTtsService } from '@/lib/qwen-tts'
import { settingsService } from '@/lib/settings-cache'
import { venice } from '@/lib/venice'
import { VOCAL_READY_FR_PROMPT, VOCAL_READY_FR_SYSTEM } from '@/lib/prompts/vocal-ready-fr'
import { VOCAL_READY_EN_PROMPT, VOCAL_READY_EN_SYSTEM } from '@/lib/prompts/vocal-ready-en'
import { logger } from '@/lib/logger'

import { logger } from '@/lib/logger'

export interface VoiceTtsOptions {
    contactPhone: string
    text: string
    agentId: string
    conversationId: number
    contactId: string
    replyToMessageId?: string
}

// Note: Shy refusals are now AI-generated, not hardcoded
// See handleAdminResponse() for the AI generation logic

export const voiceTtsService = {
    /**
     * Preprocess text for TTS using LLM (makes it sound natural when spoken)
     */
    async preprocessForVocal(text: string, locale: string): Promise<string> {
        console.log(`[VoiceTTS] Preprocessing for ${locale}: "${text.substring(0, 50)}..."`)

        const settings = await settingsService.getSettings()
        const isFrench = locale.toLowerCase().startsWith('fr')

        const systemPrompt = isFrench ? VOCAL_READY_FR_SYSTEM : VOCAL_READY_EN_SYSTEM
        const userPrompt = isFrench
            ? VOCAL_READY_FR_PROMPT + ` "${text}"`
            : VOCAL_READY_EN_PROMPT + ` "${text}"`

        try {
            const result = await venice.chatCompletion(
                systemPrompt,
                [],
                userPrompt,
                {
                    apiKey: settings.venice_api_key,
                    model: settings.venice_model || 'llama-3.3-70b',
                    temperature: 0.3, // Low for consistent conversion
                    max_tokens: 500
                }
            )

            // Clean up response (remove quotes if LLM added them)
            let cleaned = result.trim()
            if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
                cleaned = cleaned.slice(1, -1)
            }

            console.log(`[VoiceTTS] Preprocessed: "${cleaned.substring(0, 50)}..."`)
            return cleaned
        } catch (error: any) {
            console.error('[VoiceTTS] Preprocessing failed, using original text:', error.message)
            return text // Fallback to original
        }
    },

    /**
     * Generate TTS and send voice message
     * Returns true if successful, false if failed (triggers notification)
     */
    async generateAndSend(options: VoiceTtsOptions): Promise<{ success: boolean; error?: string }> {
        console.log(`[VoiceTTS] Starting TTS for ${options.contactPhone}`)

        try {
            // 0. Get Settings for Admin Number
            const settings = await settingsService.getSettings()
            const adminPhone = settings.voice_source_number

            if (!adminPhone) {
                console.warn('[VoiceTTS] No voice_source_number settings found. Sending directly to user.')
                // Fallback to direct send if no admin configured (or throw? Let's fallback for safety)
            }

            // 1. Get agent locale
            const agent = await prisma.agent.findUnique({
                where: { id: options.agentId },
                include: { voiceModel: true, profile: true }
            })

            if (!agent) {
                throw new Error('Agent not found')
            }

            const locale = agent.profile?.locale || agent.language || 'en-US'

            // 2. Check if agent has voice model configured
            if (!agent.voiceModel?.voiceSampleUrl) {
                console.warn('[VoiceTTS] No voice model configured for agent')
                throw new Error('No voice model configured')
            }

            // 3. Preprocess text for vocal-ready format
            const vocalReadyText = await this.preprocessForVocal(options.text, locale)

            // 4. Generate TTS
            console.log(`[VoiceTTS] Generating TTS with voice model: ${agent.voiceModel.name}`)
            const ttsResult = await qwenTtsService.generateVoice({
                text: vocalReadyText,
                voiceId: agent.voiceModelId!,
                agentId: options.agentId,
                language: locale.startsWith('fr') ? 'French' : 'English'
            })

            if (!ttsResult.audioBase64) {
                throw new Error('TTS generation failed - no audio returned')
            }

            // DATA HANDLING:
            // We have base64. We need to upload this to Supabase/S3 to have a permanent URL 
            // because efficient WhatsApp sending + Database storage needs a URL.
            // The previous code sent base64 directly to WA, which is fine, but for Validation Flow
            // we need to store it to send it LATER to the user without regenerating.

            // Upload to Supabase Storage
            let audioUrl = ''
            try {
                const { createClient } = require('@supabase/supabase-js');
                const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
                const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

                if (url && key) {
                    const supabase = createClient(url, key);
                    const buffer = Buffer.from(ttsResult.audioBase64, 'base64');
                    const fileName = `voice_validations/${Date.now()}_${options.conversationId}.mp3`;

                    const { error: upErr } = await supabase.storage
                        .from('voice-uploads')
                        .upload(fileName, buffer, { contentType: 'audio/mpeg' });

                    if (!upErr) {
                        const { data } = supabase.storage.from('voice-uploads').getPublicUrl(fileName);
                        audioUrl = data?.publicUrl || '';
                    } else {
                        console.error('[VoiceTTS] Supabase upload failed:', upErr);
                    }
                }
            } catch (e) {
                console.error('[VoiceTTS] URL generation failed', e);
            }

            if (!adminPhone || !audioUrl) {
                // FALLBACK: Direct Send if setup incomplete (keeps legacy behavior alive if needed)
                if (!adminPhone) logger.warn('Voice Validation Skipped: No Admin Number');
                if (!audioUrl) logger.warn('Voice Validation Skipped: URL Generation Failed');

                console.log('[VoiceTTS] Sending voice message directly (Fallback)...')
                await whatsapp.sendVoice(
                    options.contactPhone,
                    ttsResult.audioBase64,
                    options.replyToMessageId,
                    options.agentId
                )
                // Save to database
                await prisma.message.create({
                    data: {
                        conversationId: options.conversationId,
                        sender: 'ai',
                        message_text: `[VOICE] ${options.text}`,
                        timestamp: new Date()
                    }
                })
                return { success: true }
            }

            // 5. INTERCEPTION: Send to Admin for Validation
            console.log(`[VoiceTTS] Intercepting: Sending to Admin (${adminPhone}) for validation...`)

            // Send Voice to Admin
            // We use the URL if available, or base64. 
            // sending URL is better if WA supports it, else Base64. 
            // whatsapp.sendVoice supports URL or Base64.
            const sentMsgId = await whatsapp.sendVoice(
                adminPhone,
                audioUrl || ttsResult.audioBase64,
                undefined,
                options.agentId
            )

            // Send Context Text to Admin
            await whatsapp.sendText(
                adminPhone,
                `🎤 *Validation Requise*\n\n👤 Contact: ${options.contactPhone}\n📝 Texte: "${options.text}"\n\n👍 Réponds OK/Puce Valid pour envoyer.\n👎 Réponds NON/Puce Invalid pour refaire.`,
                undefined,
                options.agentId
            )

            // 6. Create Pending Validation Record
            const msgId = (sentMsgId as any)?.id?._serialized || (sentMsgId as any)?.id || `manual_${Date.now()}`

            await prisma.pendingVoiceValidation.create({
                data: {
                    contactId: options.contactId,
                    agentId: options.agentId,
                    audioUrl: audioUrl,
                    transcript: vocalReadyText,
                    originalPrompt: options.text,
                    status: 'PENDING',
                    adminPhone: adminPhone,
                    validationMsgId: msgId
                }
            })

            console.log('[VoiceTTS] Voice sent for validation successfully!')
            return { success: true } // Return success so chat.ts thinks it's handled

        } catch (error: any) {
            console.error('[VoiceTTS] Failed:', error.message)
            await this.notifyTtsFailure(options, error.message)
            return { success: false, error: error.message }
        }
    },

    /**
     * Notify admin when TTS fails - they can choose to Continue (shy refusal) or Pause
     */
    async notifyTtsFailure(options: VoiceTtsOptions, errorMessage: string): Promise<void> {
        console.log('[VoiceTTS] Sending failure notification to admin...')

        try {
            // Get conversation summary (last 5 messages)
            const recentMessages = await prisma.message.findMany({
                where: { conversationId: options.conversationId },
                orderBy: { timestamp: 'desc' },
                take: 5
            })

            const summary = recentMessages
                .reverse()
                .map(m => `${m.sender === 'ai' ? '🤖' : '👤'}: ${m.message_text.substring(0, 50)}...`)
                .join('\n')

            // Create notification
            await prisma.notification.create({
                data: {
                    type: 'TTS_FAILURE',
                    title: '🎤 TTS Vocal Failed',
                    message: `Erreur: ${errorMessage}\n\nRésumé:\n${summary}\n\nTexte à dire: "${options.text}"`,
                    agentId: options.agentId,
                    metadata: JSON.stringify({
                        contactPhone: options.contactPhone,
                        conversationId: options.conversationId,
                        contactId: options.contactId,
                        originalText: options.text,
                        error: errorMessage
                    }),
                    isRead: false
                }
            })

            console.log('[VoiceTTS] Admin notification created')
        } catch (e: any) {
            console.error('[VoiceTTS] Failed to create notification:', e.message)
        }
    },

    /**
     * Handle admin response to TTS failure
     * - "continue" → Send shy refusal text message
     * - "pause" → Pause conversation
     */
    async handleAdminResponse(
        notificationId: string,
        action: 'continue' | 'pause'
    ): Promise<{ success: boolean }> {
        const notification = await prisma.notification.findUnique({
            where: { id: notificationId }
        })

        if (!notification) {
            return { success: false }
        }

        const metadata = JSON.parse(typeof notification.metadata === 'string' ? notification.metadata : JSON.stringify(notification.metadata) || '{}')

        if (action === 'pause') {
            // Pause the conversation
            await prisma.conversation.update({
                where: { id: metadata.conversationId },
                data: { status: 'paused' }
            })
            console.log(`[VoiceTTS] Conversation ${metadata.conversationId} paused`)
        } else {
            // Generate shy refusal using AI (not hardcoded)
            const agent = await prisma.agent.findUnique({
                where: { id: notification.agentId! },
                include: { profile: true }
            })

            const locale = agent?.profile?.locale || 'en-US'
            const settings = await settingsService.getSettings()

            // Get recent context for natural response
            const recentMessages = await prisma.message.findMany({
                where: { conversationId: metadata.conversationId },
                orderBy: { timestamp: 'desc' },
                take: 3
            })

            const context = recentMessages.reverse().map(m => ({
                role: m.sender === 'contact' ? 'user' : 'ai',
                content: m.message_text
            }))

            // Instruction for AI to refuse shyly
            const refusalInstruction = locale.startsWith('fr')
                ? `[INSTRUCTION SYSTÈME]: L'utilisateur t'a demandé un message vocal mais tu ne peux pas en envoyer. Réponds timidement en refusant de faire un vocal. Reste naturelle, sois un peu gênée, dis que tu préfères écrire ou que t'es pas à l'aise pour parler. NE MENTIONNE JAMAIS de problème technique.`
                : `[SYSTEM INSTRUCTION]: The user asked for a voice note but you can't send one. Reply shyly refusing to do a voice note. Stay natural, be a bit embarrassed, say you prefer texting or you're not comfortable talking. NEVER mention any technical issue.`

            // Generate AI response with shy refusal
            const shyMessage = await venice.chatCompletion(
                refusalInstruction,
                context,
                locale.startsWith('fr') ? "Génère un refus timide pour le vocal" : "Generate a shy refusal for the voice note",
                {
                    apiKey: settings.venice_api_key,
                    model: settings.venice_model || 'llama-3.3-70b',
                    temperature: 0.7,
                    max_tokens: 100
                }
            )

            await whatsapp.sendText(metadata.contactPhone, shyMessage.trim(), undefined, notification.agentId!)

            // Save message
            await prisma.message.create({
                data: {
                    conversationId: metadata.conversationId,
                    sender: 'ai',
                    message_text: shyMessage.trim(),
                    timestamp: new Date()
                }
            })

            console.log(`[VoiceTTS] Sent AI-generated shy refusal: "${shyMessage.trim().substring(0, 50)}..."`)
        }

        // Mark notification as read
        await prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true }
        })

        return { success: true }
    }
    ,

    /**
     * Handle Admin Validation Response (OK/NO)
     */
    async handleAdminValidation(text: string, payload: any): Promise<boolean> {
        // Clean text
        const clean = text.trim().toUpperCase()
        const isApprove = clean === 'OK' || clean === 'VALID' || clean === 'YES' || clean === '👍'
        const isReject = clean === 'NO' || clean === 'INVALID' || clean === 'NON' || clean === '👎'

        if (!isApprove && !isReject) return false

        console.log(`[VoiceTTS] Admin Validation Response: ${clean}`)

        // Find the LATEST pending validation
        // We assume the admin replies to the latest one or replies to a specific message.
        // If reply context exists, use it.

        let pending: any = null

        // Try to find by quoted message ID if available
        const quotedId = payload._data?.quotedMsg?.rowId || payload.quotedMsgId
        if (quotedId) {
            pending = await prisma.pendingVoiceValidation.findFirst({
                where: { validationMsgId: quotedId }
            })
        }

        // Fallback: Find latest PENDING
        if (!pending) {
            pending = await prisma.pendingVoiceValidation.findFirst({
                where: { status: 'PENDING' },
                orderBy: { createdAt: 'desc' }
            })
        }

        if (!pending) {
            console.log('[VoiceTTS] No pending validation found to act on.')
            return false
        }

        if (isApprove) {
            console.log(`[VoiceTTS] Validation APPROVED for ${pending.contactId}`)

            // 1. Send to User
            // Retrieve Agent for correct ID
            const agent = await prisma.agent.findUnique({ where: { id: pending.agentId } })

            // Retrieve Contact Phone
            const contact = await prisma.contact.findUnique({ where: { id: pending.contactId } })
            if (!contact) return true

            await whatsapp.sendVoice(
                contact.phone_whatsapp,
                pending.audioUrl, // Use URL if possible
                undefined,
                pending.agentId
            )

            // 2. Mark as Approved
            await prisma.pendingVoiceValidation.update({
                where: { id: pending.id },
                data: { status: 'APPROVED' }
            })

            // 3. Save Message to User Conversation
            // We need to find the conversation
            const conversation = await prisma.conversation.findFirst({
                where: { contactId: contact.id, agentId: pending.agentId }
            })

            await prisma.message.create({
                data: {
                    conversationId: conversation?.id || 0, // Best effort
                    sender: 'ai',
                    message_text: `[VOICE] ${pending.originalPrompt}`,
                    timestamp: new Date()
                }
            })

            // Notify Admin
            await whatsapp.sendReaction(pending.adminPhone, payload.id, '✅', pending.agentId)

        } else if (isReject) {
            console.log(`[VoiceTTS] Validation REJECTED for ${pending.contactId}. Regenerating...`)

            await prisma.pendingVoiceValidation.update({
                where: { id: pending.id },
                data: { status: 'REJECTED' }
            })

            await whatsapp.sendReaction(pending.adminPhone, payload.id, '🔄', pending.agentId)

            // REGENERATION LOOP
            // We need to re-generate the text or just re-try TTS?
            const agent = await prisma.agent.findUnique({
                where: { id: pending.agentId },
                include: { profile: true, voiceModel: true }
            })
            const locale = agent?.profile?.locale || 'en-US'

            // Ask AI to rewrite for better pronunciation
            const rewritePrompt = locale.startsWith('fr')
                ? `La phrase suivante a mal rendu en en synthèse vocale (TTS). Réécris-la légèrement pour qu'elle sonne plus naturelle et fluide à l'oral, sans changer le sens. Phrase: "${pending.originalPrompt}"`
                : `The following sentence sounded bad in TTS. Rewrite it slightly to sound more natural and fluid when spoken, without changing the meaning. Sentence: "${pending.originalPrompt}"`

            const settings = await settingsService.getSettings()
            const newText = await venice.chatCompletion(
                "You are a TTS optimization expert.",
                [],
                rewritePrompt,
                {
                    apiKey: settings.venice_api_key,
                    model: settings.venice_model || 'llama-3.3-70b',
                    temperature: 0.7
                }
            )

            console.log(`[VoiceTTS] Regenerated Text for Retry: "${newText}"`)

            // Trigger TTS again (will hit interceptor again)
            // Find conversation ID
            const contact = await prisma.contact.findUnique({ where: { id: pending.contactId } })
            const conversation = await prisma.conversation.findFirst({
                where: { contactId: pending.contactId, agentId: pending.agentId }
            })

            if (contact && conversation) {
                // Call generateAndSend on 'this' (voiceTtsService)
                // We access it via the exported const if needed, or binding. 
                // Since we are inside the object, we can use `voiceTtsService.generateAndSend` or split the functions.
                // To be safe regarding 'this' context in this object literal structure:
                await voiceTtsService.generateAndSend({
                    contactPhone: contact.phone_whatsapp,
                    text: newText.replace(/"/g, ''), // Clean quotes
                    agentId: pending.agentId,
                    conversationId: conversation.id,
                    contactId: pending.contactId
                })
            }
        }

        return true
    }
}
