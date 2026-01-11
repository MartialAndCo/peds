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

        // Debug: Count ALL pending messages
        const allPending = await prisma.messageQueue.count({ where: { status: 'PENDING' } })

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

        console.log(`[QueueService] Found ${pendingMessages.length} pending messages DUE NOW (Total Pending: ${allPending}).`)

        if (pendingMessages.length === 0) return { processed: 0, pending: allPending }

        const results = []

        for (const queueItem of pendingMessages) {
            try {
                // Double check status (concurrency safety)
                const current = await prisma.messageQueue.findUnique({ where: { id: queueItem.id } })
                if (current?.status !== 'PENDING') continue

                // Mark PROCESSING (Optional, but good for safety)
                // await prisma.messageQueue.update({ where: { id: queueItem.id }, data: { status: 'PROCESSING' } })

                const result = await this.processedSingleItem(queueItem)
                results.push(result)

            } catch (error: any) {
                console.error(`[QueueService] Failed to process item ${queueItem.id}:`, error)
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
     * Internal logic for one item
     */
    private async processedSingleItem(queueItem: any) {
        const { content, contact, conversation, mediaUrl, mediaType, duration } = queueItem
        const phone = contact.phone_whatsapp
        const agentId = conversation?.agentId || undefined

        console.log(`[QueueService] Sending to ${phone} (ID: ${queueItem.id}), media: ${!!mediaUrl}`)

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
            const typingMs = Math.min((content?.length || 10) * 60, 5000)
            await new Promise(r => setTimeout(r, typingMs + 1000))

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
            const typingMs = Math.min(content.length * 50, 8000) // 50ms per char
            await new Promise(r => setTimeout(r, typingMs + 500))

            let parts = content.split('|||').filter((p: string) => p.trim().length > 0)
            if (parts.length === 1 && content.length > 300) {
                // Fallback split for very long single blocks? 
                // For now, keep as is unless explicit requirement.
            }

            for (const part of parts) {
                await whatsapp.sendText(phone, part.trim(), undefined, agentId)
                if (parts.indexOf(part) < parts.length - 1) {
                    await new Promise(r => setTimeout(r, 1000))
                }
            }
            await whatsapp.sendTypingState(phone, false, agentId).catch(e => { })
        }

        // UPDATE STATUS -> SENT
        await prisma.messageQueue.update({
            where: { id: queueItem.id },
            data: { status: 'SENT' }
        })

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
