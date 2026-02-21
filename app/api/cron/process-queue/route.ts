import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { queueService } from '@/lib/services/queue-service'

// Allow long processing on VPS (no serverless timeout)
export const maxDuration = 300

export async function GET(req: Request) {
    try {
        console.log('[Cron] Triggered process-queue endpoint')

        // DB-based concurrency guard: check if messages are actively being processed
        // This replaces the old in-memory guard that caused stuck queues
        const activeProcessing = await prisma.messageQueue.count({
            where: {
                status: 'PROCESSING',
                updatedAt: { gt: new Date(Date.now() - 120_000) } // Updated within last 2 min
            }
        })

        if (activeProcessing > 0) {
            console.log(`[Cron] ${activeProcessing} messages actively processing (updated <2min ago). Skipping.`)
            return NextResponse.json({
                success: true,
                message: `Skipped: ${activeProcessing} messages still processing`,
                activeProcessing,
                timestamp: new Date().toISOString()
            })
        }

        // Synchronous processing (VPS has no timeout constraint)
        const result = await queueService.processPendingMessages()

        console.log(`[Cron] process-queue complete. Processed: ${result.processed}`)

        return NextResponse.json({
            success: true,
            ...result,
            timestamp: new Date().toISOString()
        })

    } catch (error: any) {
        console.error('[Cron] Fatal Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
