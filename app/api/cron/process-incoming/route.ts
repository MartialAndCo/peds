import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processWhatsAppPayload } from '@/lib/services/whatsapp-processor'
import { logger, trace } from '@/lib/logger'

/**
 * CRON Endpoint: Process Incoming Message Queue
 * 
 * Processes queued incoming WhatsApp messages.
 * Should be triggered every minute for fast response times.
 * 
 * Vercel Cron: Add to vercel.json:
 * { "crons": [{ "path": "/api/cron/process-incoming", "schedule": "* * * * *" }] }
 */
export async function GET(req: Request) {
    try {
        console.log('[CRON] Processing incoming message queue...')

        // Find pending items (limit to 10 to avoid Lambda timeout)
        const pending = await prisma.incomingQueue.findMany({
            where: { status: 'PENDING' },
            take: 10,
            orderBy: { createdAt: 'asc' }
        })

        if (pending.length === 0) {
            return NextResponse.json({ success: true, processed: 0, message: 'Queue empty' })
        }

        console.log(`[CRON] Found ${pending.length} pending messages to process`)

        let processed = 0
        let failed = 0

        for (const item of pending) {
            // Atomic lock: Only process if still PENDING
            const lock = await prisma.incomingQueue.updateMany({
                where: { id: item.id, status: 'PENDING' },
                data: { status: 'PROCESSING' }
            })

            if (lock.count === 0) {
                console.log(`[CRON] Item ${item.id} already being processed, skipping`)
                continue
            }

            try {
                const payload = item.payload as any
                const traceId = trace.generate()

                console.log(`[CRON] Processing item ${item.id} for agent ${item.agentId}`)

                await trace.runAsync(traceId, item.agentId, async () => {
                    return await processWhatsAppPayload(payload.payload, item.agentId)
                })

                // Mark as done
                await prisma.incomingQueue.update({
                    where: { id: item.id },
                    data: {
                        status: 'DONE',
                        processedAt: new Date()
                    }
                })

                processed++
                console.log(`[CRON] Item ${item.id} processed successfully`)

            } catch (err: any) {
                console.error(`[CRON] Failed to process item ${item.id}:`, err)

                // Mark as failed with retry info
                await prisma.incomingQueue.update({
                    where: { id: item.id },
                    data: {
                        status: item.attempts >= 2 ? 'FAILED' : 'PENDING', // Retry up to 3 times
                        attempts: { increment: 1 },
                        error: err.message
                    }
                })

                failed++
            }
        }

        return NextResponse.json({
            success: true,
            processed,
            failed,
            total: pending.length
        })

    } catch (error: any) {
        console.error('[CRON] Fatal error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
