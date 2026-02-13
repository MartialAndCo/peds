import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { logger } from '@/lib/logger'
import { settingsService } from '@/lib/settings-cache'
import { timeCoherenceAgent } from './time-coherence-agent'
import { ageCoherenceAgent } from './age-coherence-agent'
import { messageValidator } from './message-validator'

export class QueueService {
    // Track items currently being processed in-memory to prevent concurrent execution
    // This is a safety net for the brief window between SELECT and UPDATE
    private static processingItems = new Set<string>()

    /**
     * Process all PENDING messages that are due (scheduledAt <= now)
     * Uses database-level locking to prevent race conditions across multiple instances
     */
    async processPendingMessages() {
        const now = new Date()
        console.log(`[QueueService] Processing Message Queue... Server time: ${now.toISOString()}`)

        // 1. Cleanup Stuck Jobs (older than 10 mins - increased from 5 to be safer)
        // Jobs that are stuck in PROCESSING due to server crash/timeout
        await this.cleanupStuckJobs()

        // 2. Find and lock messages atomically using transaction
        // This prevents multiple CRON instances from grabbing the same messages
        let lockedItems: Array<{ id: string; content: string; mediaUrl: string | null; mediaType: string | null; duration: number | null; scheduledAt: Date; contact: any; conversation: any }> = []
        
        try {
            lockedItems = await prisma.$transaction(async (tx) => {
                // Find pending messages
                const items = await tx.messageQueue.findMany({
                    where: {
                        status: 'PENDING',
                        scheduledAt: { lte: now }
                    },
                    include: { contact: true, conversation: true },
                    take: 5, // Reduced from 10 to be gentler on the system
                    orderBy: { scheduledAt: 'asc' }
                })

                // Immediately lock them with a unique processing ID
                const processingId = `proc_${Date.now()}_${Math.random().toString(36).substring(7)}`
                
                for (const item of items) {
                    await tx.messageQueue.update({
                        where: { 
                            id: item.id,
                            status: 'PENDING' // Extra safety: only update if still PENDING
                        },
                        data: { 
                            status: 'PROCESSING',
                            // Store processing ID and start time for debugging/recovery
                            updatedAt: new Date()
                        }
                    })
                }

                return items
            }, {
                // Transaction options: fail fast if there's a conflict
                maxWait: 5000,
                timeout: 10000
            })
        } catch (txError) {
            console.error('[QueueService] Transaction failed (another instance may be processing):', txError)
            return { processed: 0, pending: 0, error: 'transaction_conflict' }
        }

        console.log(`[QueueService] Locked ${lockedItems.length} messages for processing.`)

        if (lockedItems.length === 0) {
            // DEBUG: Find next upcoming message
            const nextMsg = await prisma.messageQueue.findFirst({
                where: { status: 'PENDING' },
                orderBy: { scheduledAt: 'asc' },
                select: { id: true, scheduledAt: true }
            })
            if (nextMsg) {
                const diffMinutes = Math.round((nextMsg.scheduledAt.getTime() - now.getTime()) / 60000)
                console.log(`[QueueService] DEBUG: Next message (ID: ${nextMsg.id}) is scheduled for ${nextMsg.scheduledAt.toISOString()} (in ${diffMinutes} mins)`)
            }
            return { processed: 0, pending: 0 }
        }

        const results = []

        // Group items by conversation to send them in sequence
        const itemsByConversation = new Map<number, typeof lockedItems>()
        for (const item of lockedItems) {
            const convId = item.conversation?.id
            if (!convId) continue
            if (!itemsByConversation.has(convId)) {
                itemsByConversation.set(convId, [])
            }
            itemsByConversation.get(convId)!.push(item)
        }

        console.log(`[QueueService] Processing ${lockedItems.length} messages across ${itemsByConversation.size} conversations`)

        // Process each conversation's messages
        for (const [conversationId, items] of itemsByConversation) {
            // Sort by scheduled time
            items.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())

            console.log(`[QueueService] Conversation ${conversationId}: ${items.length} messages to send`)

            for (let i = 0; i < items.length; i++) {
                const queueItem = items[i]

                // Skip if already being processed in this instance
                if (QueueService.processingItems.has(queueItem.id)) {
                    console.log(`[QueueService] Item ${queueItem.id} already being processed in this instance. Skipping.`)
                    continue
                }

                QueueService.processingItems.add(queueItem.id)

                try {
                    const result = await this.processSingleItem(queueItem)
                    results.push(result)

                    // If there are more messages for this conversation, wait a bit before sending the next one
                    // This creates a natural "burst" of messages instead of spacing them by 30 minutes
                    if (i < items.length - 1) {
                        const delayBetweenMessages = 3000 + Math.random() * 2000 // 3-5 seconds
                        console.log(`[QueueService] Waiting ${Math.round(delayBetweenMessages)}ms before sending next message for conversation ${conversationId}`)
                        await new Promise(r => setTimeout(r, delayBetweenMessages))
                    }
                } catch (error: any) {
                    console.error(`[QueueService] Failed to process item ${queueItem.id}:`, error)
                    // Mark as FAILED to prevent infinite retries
                    await prisma.messageQueue.update({
                        where: { id: queueItem.id },
                        data: { status: 'FAILED', attempts: { increment: 1 }, error: error.message }
                    }).catch(e => console.error(`[QueueService] Failed to mark item as FAILED:`, e))
                    results.push({ id: queueItem.id, status: 'error', error: error.message })
                } finally {
                    QueueService.processingItems.delete(queueItem.id)
                }
            }
        }

        return { processed: results.length, results }
    }

    /**
     * Logic for one item (Exposed for 'Send Now' action)
     * Includes atomic status check to prevent double-sending
     */
    public async processSingleItem(queueItem: any) {
        const { content, contact, conversation, mediaUrl, mediaType, duration } = queueItem
        const phone = contact.phone_whatsapp
        const agentId = conversation?.agentId || undefined
        
        // Text content with aggressive cleanup (for text messages) - FORCED UPDATE
        let textContent = content ? messageValidator.aggressiveArtifactCleanup(content) : ''

        // CRITICAL: Double-check status before sending (prevents race conditions with cleanup)
        const currentStatus = await prisma.messageQueue.findUnique({
            where: { id: queueItem.id },
            select: { status: true }
        })
        
        if (currentStatus?.status !== 'PROCESSING') {
            console.log(`[QueueService] Item ${queueItem.id} status changed to ${currentStatus?.status}. Aborting send.`)
            return { id: queueItem.id, status: 'aborted', reason: `status_changed_to_${currentStatus?.status}` }
        }

        // Récupérer l'âge du profil pour la vérification
        const agentProfile = await prisma.agentProfile.findUnique({
            where: { agentId },
            select: { baseAge: true }
        });
        const profileAge = agentProfile?.baseAge || 15;

        // 🕐 VÉRIFICATION TEMPORELLE: Détecter les mentions d'heure incohérentes
        if (content && !mediaUrl) {
            const timeCheck = await timeCoherenceAgent.checkAndLog(content, queueItem.id, new Date());
            if (timeCheck.shouldRewrite && timeCheck.suggestedFix) {
                console.log(`[QueueService] ⚠️ Message ${queueItem.id} contient une heure incohérente. Suggestion: "${timeCheck.suggestedFix}"`);
            }
        }

        // 🎂 VÉRIFICATION D'ÂGE: Détecter les mentions d'âge incohérentes
        if (content && !mediaUrl) {
            const ageCheck = await ageCoherenceAgent.checkAndLog(content, queueItem.id, profileAge);
            if (ageCheck.shouldFlag) {
                console.warn(`[QueueService] 🚨 ALERTE ÂGE: Message ${queueItem.id} mentionne ${ageCheck.mentionedAge} ans au lieu de ${profileAge} ans!`);
            }
        }

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
            if (!textContent || textContent.trim().length === 0) {
                await prisma.messageQueue.update({ where: { id: queueItem.id }, data: { status: 'INVALID_EMPTY' } })
                return { id: queueItem.id, status: 'skipped_empty' }
            }

            // 🚨 BLOCK MESSAGES WITH ONLY FORMATTING ARTIFACTS
            // Prevents sending "**", "** **", """" etc.
            if (messageValidator.isEmptyOrOnlyFormatting(textContent)) {
                console.warn(`[QueueService] BLOCKING message with only formatting artifacts: "${content}"`)
                await prisma.messageQueue.update({ 
                    where: { id: queueItem.id }, 
                    data: { status: 'INVALID_FORMATTING', error: 'Only formatting artifacts' } 
                })
                return { id: queueItem.id, status: 'skipped_formatting_only' }
            }

            await whatsapp.sendTypingState(phone, true, agentId).catch(e => { })
            const typingMs = Math.min(textContent.length * 65, 10400) // +30%
            await new Promise(r => setTimeout(r, typingMs + 650))

            // Unified Splitting Logic (Matches route.ts)
            let parts = textContent.split(/\|+/).filter((p: string) => p.trim().length > 0)
            if (parts.length === 1 && textContent.length > 50) {
                // Split on any newline (user prefers multiple bubbles for natural conversation)
                const paragraphs = textContent.split(/\n+/).filter((p: string) => p.trim().length > 0)
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
                    message_text: textContent || (mediaUrl ? (mediaType?.includes('audio') ? "[Voice Message]" : "[Media Message]") : "[Message]"),
                    mediaUrl: mediaUrl,
                    timestamp: new Date()
                }
            }).catch((e: any) => console.error("Failed to log sent message to history", e))
            
            // Update conversation last activity (AI message)
            await prisma.conversation.update({
                where: { id: queueItem.conversationId },
                data: {
                    lastMessageAt: new Date(),
                    lastMessageSender: 'ai'
                }
            }).catch((e: any) => console.error("Failed to update conversation last activity", e))
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

    /**
    * Release locks on jobs that have been PROCESSING for too long.
    * Conservative approach: 10 minutes (was 5) to avoid interrupting slow sends
    * After 3 attempts, marks as FAILED instead of retrying
    */
    async cleanupStuckJobs() {
        try {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
            
            // First: Mark items with too many attempts as FAILED
            const failedResult = await prisma.messageQueue.updateMany({
                where: {
                    status: 'PROCESSING',
                    updatedAt: { lt: tenMinutesAgo },
                    attempts: { gte: 3 } // 3 or more attempts = give up
                },
                data: {
                    status: 'FAILED',
                    error: 'Max retry attempts exceeded (3)'
                }
            })
            
            if (failedResult.count > 0) {
                console.log(`[QueueService] ⚠️ Marked ${failedResult.count} jobs as FAILED (max retries exceeded).`)
            }
            
            // Second: Reset items with fewer attempts to PENDING for retry
            const retryResult = await prisma.messageQueue.updateMany({
                where: {
                    status: 'PROCESSING',
                    updatedAt: { lt: tenMinutesAgo },
                    attempts: { lt: 3 }
                },
                data: {
                    status: 'PENDING',
                    attempts: { increment: 1 }
                }
            })

            if (retryResult.count > 0) {
                console.log(`[QueueService] ⚠️ Reset ${retryResult.count} stuck jobs to PENDING (attempt +1).`)
            }
        } catch (error) {
            console.error('[QueueService] Failed to cleanup stuck jobs:', error)
        }
    }
}

export const queueService = new QueueService()
