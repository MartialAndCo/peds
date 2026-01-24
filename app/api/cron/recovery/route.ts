import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processWhatsAppPayload } from '@/lib/services/whatsapp-processor'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    try {
        // 1. Find PENDING events older than 2 minutes (stuck?)
        // OR process "PENDING" events that were just created if we use this as the primary worker (not fire-and-forget).
        // Since we use Fire-and-Forget, "PENDING" usually means the fire-and-forget process hasn't finished OR it crashed.
        // We look for items created > 2 mins ago.

        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)

        const stuckEvents = await prisma.webhookEvent.findMany({
            where: {
                status: 'PENDING',
                createdAt: { lt: twoMinutesAgo }
            },
            take: 20 // Process in small batches
        })

        console.log(`[Cron:Recovery] Found ${stuckEvents.length} stuck events.`)

        const results = []

        for (const event of stuckEvents) {
            try {
                // Double check status (race condition)
                // Not strictly necessary if single cron worker

                // Process
                const body = event.payload as any
                // Use string for sessionId (Agent CUID)
                const sessionId = body.sessionId ? body.sessionId.toString() : 'default'

                await processWhatsAppPayload(body.payload, sessionId)

                await prisma.webhookEvent.update({
                    where: { id: event.id },
                    data: { status: 'PROCESSED', processedAt: new Date(), error: 'Recovered by Cron' }
                })
                results.push({ id: event.id, status: 'recovered' })

            } catch (err: any) {
                console.error(`[Cron:Recovery] Failed to recover event ${event.id}:`, err)
                await prisma.webhookEvent.update({
                    where: { id: event.id },
                    data: { status: 'FAILED', error: `Recovery Failed: ${err.message}` }
                })
                results.push({ id: event.id, status: 'failed', error: err.message })
            }
        }

        return NextResponse.json({ success: true, results })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
