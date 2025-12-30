import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'

export class QueueWorker {
    private static isRunning = false
    private static intervalId: NodeJS.Timeout | null = null
    // Check every 30 seconds for smoother distribution
    private static CHECK_INTERVAL = 30 * 1000

    static start() {
        console.log('[QueueWorker] Start Ignored (Disabled for Serverless Safety)')
        return; // HARD DISABLE

        if (this.isRunning) return
        this.isRunning = true
        console.log('[QueueWorker] Starting integrated background worker...')

        // Initial tick
        this.tick()

        // Loop
        this.intervalId = setInterval(() => this.tick(), this.CHECK_INTERVAL)
    }

    static stop() {
        if (this.intervalId) clearInterval(this.intervalId)
        this.isRunning = false
        console.log('[QueueWorker] Stopped.')
    }

    private static async tick() {
        try {
            // 1. Find Pending Messages due NOW (or in the past)
            const pendingMessages = await prisma.messageQueue.findMany({
                where: {
                    status: 'PENDING',
                    scheduledAt: {
                        lte: new Date() // Due now or before
                    }
                },
                include: {
                    contact: true
                },
                take: 50 // Batch size
            })

            if (pendingMessages.length === 0) return

            console.log(`[QueueWorker] Processing ${pendingMessages.length} messages scheduled for now...`)

            for (const queueItem of pendingMessages) {
                try {
                    // Update to SENT immediately to prevent double-send (Optimistic)
                    // (Real production would use 'start transaction' or 'processing' status, 
                    // but for this scale, atomic update is fine).
                    await prisma.messageQueue.update({
                        where: { id: queueItem.id },
                        data: { status: 'SENT' }
                    })

                    // 2. Send Logic
                    await this.processItem(queueItem)

                } catch (error) {
                    console.error(`[QueueWorker] Failed item ${queueItem.id}`, error)
                    // Revert to PENDING or FAILED? FAILED to avoid loop.
                    await prisma.messageQueue.update({
                        where: { id: queueItem.id },
                        data: { status: 'FAILED' } // We can implement a retry later
                    })
                }
            }
        } catch (error) {
            console.error('[QueueWorker] Tick Error:', error)
        }
    }

    private static async processItem(queueItem: any) {
        const { content, contact } = queueItem
        const phone = contact.phone_whatsapp

        // Mark Read
        await whatsapp.markAsRead(phone).catch(() => { })

        // Simulate Typing (Dynamic duration based on length)
        await whatsapp.sendTypingState(phone, true).catch(() => { })

        // Calculate typing duration: ~50ms per char, min 2s, max 15s
        const totalChars = content.length;
        const typingDuration = Math.min(15000, Math.max(2000, totalChars * 50));
        await new Promise(r => setTimeout(r, typingDuration));

        // Stop Typing
        await whatsapp.sendTypingState(phone, false).catch(() => { })

        // Random tiny variance before actual send (0-2s)
        await new Promise(r => setTimeout(r, Math.random() * 1000))

        // Split logic (Text bubbles)
        let parts = content.split('|||').filter((p: string) => p.trim().length > 0)
        if (parts.length === 1 && content.length > 50) {
            const paragraphs = content.split(/\n\s*\n/).filter((p: string) => p.trim().length > 0)
            if (paragraphs.length > 1) parts = paragraphs
        }

        for (const part of parts) {
            await whatsapp.sendText(phone, part.trim())
            if (parts.indexOf(part) < parts.length - 1) {
                // Pause between bubbles
                await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000))
            }
        }

        // Save to History (Real Message Table)
        const savedMsg = await prisma.message.create({
            data: {
                conversationId: queueItem.conversationId,
                sender: 'ai',
                message_text: content.replace(/\|\|\|/g, '\n'),
                timestamp: new Date()
            }
        })

        console.log(`[QueueWorker] Sent to ${contact.name || phone}: "${content.substring(0, 20)}..."`)
    }
}
