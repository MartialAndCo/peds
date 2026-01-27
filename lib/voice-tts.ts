// lib/voice-tts.ts
// Direct TTS service - bypasses human, uses Qwen TTS with LLM preprocessing

import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { qwenTtsService } from '@/lib/qwen-tts'
import { settingsService } from '@/lib/settings-cache'
import { venice } from '@/lib/venice'
import { VOCAL_READY_FR_PROMPT, VOCAL_READY_FR_SYSTEM } from '@/lib/prompts/vocal-ready-fr'
import { VOCAL_READY_EN_PROMPT, VOCAL_READY_EN_SYSTEM } from '@/lib/prompts/vocal-ready-en'

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

            // 5. Send voice message via WhatsApp
            console.log('[VoiceTTS] Sending voice message...')
            await whatsapp.sendVoice(
                options.contactPhone,
                ttsResult.audioBase64,
                options.replyToMessageId,
                options.agentId
            )

            // 6. Save to database
            await prisma.message.create({
                data: {
                    conversationId: options.conversationId,
                    sender: 'ai',
                    message_text: `[VOICE] ${options.text}`,
                    timestamp: new Date()
                }
            })

            console.log('[VoiceTTS] Voice message sent successfully!')
            return { success: true }

        } catch (error: any) {
            console.error('[VoiceTTS] Failed:', error.message)

            // Notify admin about failure
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
}
