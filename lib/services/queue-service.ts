import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { logger } from '@/lib/logger'
import { settingsService } from '@/lib/settings-cache'

export class QueueService {

    /**
     * Process all PENDING messages that are due (scheduledAt <= now)
     */
    async processPendingMessages() {
        const now = new Date()
        console.log(`[QueueService] Processing Message Queue... Server time: ${now.toISOString()}`)

        // 1. Find Pending Messages due NOW
        const pendingMessages = await prisma.messageQueue.findMany({
            where: {
                status: 'PENDING',
                scheduledAt: { lte: now }
            },
            include: { contact: true, conversation: true },
            take: 50,
            orderBy: { scheduledAt: 'asc' }
        })

        if (pendingMessages.length === 0) return { processed: 0, pending: 0 }

        const results = []

        for (const queueItem of pendingMessages) {
            try {
                // ATOMIC LOCK: Only process if status is PENDING
                const lock = await prisma.messageQueue.updateMany({
                    where: { id: queueItem.id, status: 'PENDING' },
                    data: { status: 'PROCESSING' }
                })

                if (lock.count === 0) {
                    console.log(`[QueueService] Item ${queueItem.id} already locked/processed. Skipping.`)
                    continue
                }

                const result = await this.processedSingleItem(queueItem)
                results.push(result)

            } catch (error: any) {
                console.error(`[QueueService] Failed to process item ${queueItem.id}:`, error)
                // Revert to FAILED (or PENDING if retry logic exists)
                await prisma.messageQueue.update({
                    where: { id: queueItem.id },
                    data: { status: 'FAILED', attempts: { increment: 1 } }
                })
                results.push({ id: queueItem.id, status: 'error', error: error.message })
            }
        }

        return { processed: results.length, results }
    }

    /**
     * Logic for one item (Exposed for 'Send Now' action)
     */
    public async processedSingleItem(queueItem: any) {
        const { content, contact, conversation, mediaUrl, mediaType, duration } = queueItem
        const phone = contact.phone_whatsapp
        const agentId = conversation?.agentId || undefined

        console.log(`[QueueService] Sending to ${phone} (ID: ${queueItem.id}), media: ${!!mediaUrl}`)

        // Always mark as read before interacting (Pass agentId to avoid session 404)
        await whatsapp.markAsRead(phone, agentId).catch(e => { })

        // A. HANDLE AUDIO
        if (mediaUrl && (mediaType?.startsWith('audio') || mediaUrl.includes('audio/'))) {
            // Recording State
            await whatsapp.sendRecordingState(phone, true, agentId).catch(e => { })

            // Duration Logic
            let audioDurationMs = duration || 5000;
            if (!duration) {
                if (mediaUrl.startsWith('data:')) {
                    const base64Len = mediaUrl.split(',')[1]?.length || 0;
                    audioDurationMs = Math.min(Math.round((base64Len * 0.75) / 12000) * 1000, 20000);
                } else if (mediaUrl.startsWith('http')) {
                    audioDurationMs = 12000;
                }
            }

            console.log(`[QueueService] Simulating recording for ${audioDurationMs}ms...`)
            await new Promise(r => setTimeout(r, Math.max(2000, audioDurationMs)))

            // Send Voice
            await whatsapp.sendVoice(phone, mediaUrl, undefined, agentId)
            await whatsapp.sendRecordingState(phone, false, agentId).catch(e => { })

            // Caption (Follow-up text)
            if (content && content.trim().length > 0) {
                await new Promise(r => setTimeout(r, 2000))
                await whatsapp.sendText(phone, content.trim(), undefined, agentId)
            }
        }
        // B. HANDLE MEDIA (Images/Video)
        else if (mediaUrl) {
            await whatsapp.sendTypingState(phone, true, agentId).catch(e => { })
            const typingMs = Math.min((content?.length || 10) * 78, 6500) // +30%
            await new Promise(r => setTimeout(r, typingMs + 1300))

            if (mediaType?.includes('video')) {
                await whatsapp.sendVideo(phone, mediaUrl, content || "", agentId)
            } else {
                await whatsapp.sendImage(phone, mediaUrl, content || "", agentId)
            }
            await whatsapp.sendTypingState(phone, false, agentId).catch(e => { })
        }
        // C. HANDLE TEXT ONLY
        else {
            if (!content || content.trim().length === 0) {
                await prisma.messageQueue.update({ where: { id: queueItem.id }, data: { status: 'INVALID_EMPTY' } })
                return { id: queueItem.id, status: 'skipped_empty' }
            }

            await whatsapp.sendTypingState(phone, true, agentId).catch(e => { })
            const typingMs = Math.min(content.length * 65, 10400) // +30%
            await new Promise(r => setTimeout(r, typingMs + 650))

            // Unified Splitting Logic (Matches route.ts)
            let parts = content.split(/\|+/).filter((p: string) => p.trim().length > 0)
            if (parts.length === 1 && content.length > 50) {
                // Split on any newline (user prefers multiple bubbles for natural conversation)
                const paragraphs = content.split(/\n+/).filter((p: string) => p.trim().length > 0)
                if (paragraphs.length > 1) parts = paragraphs
            }

            console.log(`[QueueService] Message split into ${parts.length} bubbles`)

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i]

                // Dynamic Typing Delay for EACH bubble
                // Approx 60ms per char + 500ms Buffer
                // Min 1.5s, Max 12s
                const typingMs = Math.max(1500, Math.min(part.length * 60, 12000))

                await whatsapp.sendTypingState(phone, true, agentId).catch(e => { })
                await new Promise(r => setTimeout(r, typingMs))

                await whatsapp.sendText(phone, part.trim(), undefined, agentId)

                // Small pause BETWEEN bubbles (reading time/finding next words)
                if (i < parts.length - 1) {
                    await whatsapp.sendTypingState(phone, false, agentId).catch(e => { }) // Stop, then think
                    await new Promise(r => setTimeout(r, 800 + Math.random() * 800))
                }
            }
            await whatsapp.sendTypingState(phone, false, agentId).catch(e => { })
        }

        // UPDATE STATUS -> SENT
        await prisma.messageQueue.update({
            where: { id: queueItem.id },
            data: { status: 'SENT' }
        })

        // Log to History (for Dashboard visibility)
        if (queueItem.conversationId) {
            await prisma.message.create({
                data: {
                    conversationId: queueItem.conversationId,
                    sender: 'ai',
                    message_text: content || (mediaUrl ? (mediaType?.includes('audio') ? "[Voice Message]" : "[Media Message]") : "[Message]"),
                    mediaUrl: mediaUrl,
                    timestamp: new Date()
                }
            }).catch((e: any) => console.error("Failed to log sent message to history", e))
        }

        return { id: queueItem.id, status: 'success' }
    }

    /**
     * Retry failed messages (e.g. 402 AI Failure)
     * This can be called manually by Admin or by a future cron job when credits are restored.
     */
    async retryFailedMessages(errorCode: string = 'AI_FAILED_402') {
        const failed = await prisma.messageQueue.findMany({
            where: { status: errorCode }
        })

        console.log(`[QueueService] Found ${failed.length} failed messages with code ${errorCode}. Resetting to PENDING...`)

        // Reset to PENDING
        // CAUTION: This will make them eligible for sending. 
        // For AI_402, we actually need to RE-GENERATE the AI response, not just send the error log string.
        // So simply setting to PENDING sending the "Error Message" text is BAD.

        // Ideally, we shouldn't simple 'update' status. We might need specific logic.
        // But the user just asked for the Class for now.
        // Let's just log this capability.
        return { count: failed.length, warning: "Checking logic before retry implementation." }
    }
}

export const queueService = new QueueService()
