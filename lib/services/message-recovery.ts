import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * Message Recovery Service
 * 
 * Periodically checks for "orphan" messages - messages from contacts that never
 * received an AI response due to bugs, timeouts, or other failures.
 * 
 * When found, it triggers the AI to respond to these forgotten messages.
 */
export class MessageRecoveryService {

    // How old a message must be before we consider it "orphaned" (in minutes)
    // Reverted to 5m per user request, but handling response logic dynamically to avoid "sorry" spam.
    private readonly ORPHAN_THRESHOLD_MINUTES = 5

    // Maximum number of conversations to recover per run (prevents overload)
    private readonly MAX_RECOVER_PER_RUN = 10

    /**
     * Find and recover orphan messages
     * An orphan is when:
     *   - Conversation is ACTIVE (not paused)
     *   - AI is enabled for the conversation
     *   - Last message is from CONTACT (not AI)
     *   - That message is older than ORPHAN_THRESHOLD_MINUTES
     */
    async recoverOrphanMessages(): Promise<{ recovered: number; details: any[] }> {
        const thresholdTime = new Date(Date.now() - this.ORPHAN_THRESHOLD_MINUTES * 60 * 1000)

        console.log(`[Recovery] Scanning for orphan messages older than ${this.ORPHAN_THRESHOLD_MINUTES} minutes...`)

        // Find active conversations with potential orphan messages
        const activeConversations = await prisma.conversation.findMany({
            where: {
                status: 'active',
                ai_enabled: true
            },
            include: {
                contact: true,
                prompt: true,
                messages: {
                    orderBy: { timestamp: 'desc' },
                    take: 5 // Only need recent messages to check
                }
            }
        })

        const orphans: any[] = []

        for (const conv of activeConversations) {
            if (conv.messages.length === 0) continue

            // Get the most recent message
            const lastMessage = conv.messages[0]

            // Check if it's from the contact (not AI) and is old enough
            if (
                lastMessage.sender === 'contact' &&
                lastMessage.timestamp < thresholdTime
            ) {
                // Count consecutive unanswered messages
                let unansweredCount = 0
                for (const msg of conv.messages) {
                    if (msg.sender === 'contact') unansweredCount++
                    else break
                }

                orphans.push({
                    conversationId: conv.id,
                    contactId: conv.contactId,
                    contactPhone: conv.contact.phone_whatsapp,
                    agentId: conv.agentId,
                    lastMessageTime: lastMessage.timestamp,
                    unansweredCount,
                    lastMessagePreview: lastMessage.message_text.substring(0, 50)
                })
            }
        }

        console.log(`[Recovery] Found ${orphans.length} orphan conversations`)

        if (orphans.length === 0) {
            return { recovered: 0, details: [] }
        }

        // Recover up to MAX_RECOVER_PER_RUN
        const toRecover = orphans.slice(0, this.MAX_RECOVER_PER_RUN)
        const results: any[] = []

        for (const orphan of toRecover) {
            try {
                logger.info('Recovering orphan message', {
                    module: 'recovery',
                    conversationId: orphan.conversationId,
                    unansweredCount: orphan.unansweredCount
                })

                // Trigger re-processing by calling the webhook handler internally
                // We create a synthetic "recovery" event
                const result = await this.triggerRecovery(orphan)
                results.push({ ...orphan, status: 'recovered', result })

            } catch (error: any) {
                console.error(`[Recovery] Failed to recover conversation ${orphan.conversationId}:`, error)
                results.push({ ...orphan, status: 'failed', error: error.message })
            }
        }

        return { recovered: results.filter(r => r.status === 'recovered').length, details: results }
    }

    /**
     * Trigger recovery for a specific orphan conversation
     */
    private async triggerRecovery(orphan: any): Promise<any> {
        const { queueService } = require('@/lib/services/queue-service')

        // Get conversation with full details
        const conversation = await prisma.conversation.findUnique({
            where: { id: orphan.conversationId },
            include: { contact: true, prompt: true }
        })

        if (!conversation) {
            throw new Error('Conversation not found')
        }

        // Get all unanswered messages
        const messages = await prisma.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { timestamp: 'desc' },
            take: 20
        })

        // Collect unanswered messages
        const unansweredMessages: string[] = []
        for (const msg of messages) {
            if (msg.sender === 'contact') {
                unansweredMessages.unshift(msg.message_text)
            } else {
                break
            }
        }

        if (unansweredMessages.length === 0) {
            return { status: 'no_messages_to_recover' }
        }

        // Calculate delay in hours for context
        const lastMsgTime = new Date(orphan.lastMessageTime).getTime();
        const now = Date.now();
        const hoursDelayed = Math.floor((now - lastMsgTime) / (1000 * 60 * 60));

        let instruction = "(RECOVERY - User sent messages that weren't answered. Respond naturally. DO NOT apologize for the delay, just continue conversation.)";

        if (hoursDelayed >= 6) {
            instruction = `(RECOVERY - It has been ${hoursDelayed} hours since the user messaged. Apologize for the delay and respond to their messages.)`;
        } else if (hoursDelayed >= 12) {
            instruction = `(RECOVERY - It has been ${hoursDelayed} hours. Sincerely apologize for the long wait and respond.)`;
        }

        // Create a batched message for AI
        const batchedMessage = unansweredMessages.length > 1
            ? `${instruction}\nMessages:\n${unansweredMessages.map((m, i) => `[${i + 1}]: ${m}`).join('\n')}`
            : `${instruction}\nMessage: "${unansweredMessages[0]}"`

        console.log(`[Recovery] Generating AI response for ${unansweredMessages.length} orphan messages`)

        // Import chat handler and call AI generation
        const { settingsService } = require('@/lib/settings-cache')
        const settings = await settingsService.getSettings()

        // Get agent settings
        const agentSettings = await prisma.agentSetting.findMany({
            where: { agentId: conversation.agentId || 1 }
        })
        agentSettings.forEach((s: any) => { settings[s.key] = s.value })

        // Generate AI response
        const { venice } = require('@/lib/venice')
        const { anthropic } = require('@/lib/anthropic')
        const { director } = require('@/lib/director')

        const { phase, details } = await director.determinePhase(conversation.contact.phone_whatsapp)
        const systemPrompt = await director.buildSystemPrompt(
            settings,
            conversation.contact,
            phase,
            details,
            conversation.prompt?.system_prompt || 'You are helpful.',
            conversation.agentId
        )

        const provider = settings.ai_provider || 'venice'
        let responseText = ''

        // Build context from history
        const historyMessages = messages.reverse().map((m: any) => ({
            role: m.sender === 'contact' ? 'user' : 'assistant',
            content: m.message_text
        }))
        const context = historyMessages.slice(0, -1)

        if (provider === 'anthropic') {
            responseText = await anthropic.chatCompletion(
                systemPrompt,
                context,
                batchedMessage,
                { apiKey: settings.anthropic_api_key, model: settings.anthropic_model }
            )
        } else {
            responseText = await venice.chatCompletion(
                systemPrompt,
                context,
                batchedMessage,
                { apiKey: settings.venice_api_key, model: settings.venice_model }
            )
        }

        if (!responseText || responseText.trim().length === 0) {
            throw new Error('AI returned empty response during recovery')
        }

        // Clean response
        responseText = responseText.replace(new RegExp('\\*[^*]+\\*', 'g'), '').trim()

        // Save AI message to history
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'ai',
                message_text: responseText.replace(/\|\|\|/g, '\n'),
                timestamp: new Date()
            }
        })

        // Queue for sending
        await prisma.messageQueue.create({
            data: {
                contactId: conversation.contactId,
                conversationId: conversation.id,
                content: responseText,
                scheduledAt: new Date(),
                status: 'PENDING'
            }
        })

        // Process queue immediately
        await queueService.processPendingMessages()

        return {
            status: 'success',
            messagesRecovered: unansweredMessages.length,
            responsePreview: responseText.substring(0, 100)
        }
    }
}

export const messageRecoveryService = new MessageRecoveryService()
