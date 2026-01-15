import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * WhatsApp Webhook Handler
 * 
 * Receives messages from Baileys and queues them for async processing.
 * Returns 200 immediately to prevent timeout issues.
 * 
 * Processing happens via CRON: /api/cron/process-incoming
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        console.log('[Webhook] Received Payload:', JSON.stringify(body, null, 2))

        // 1. Security Check
        const secret = req.headers.get('x-internal-secret')
        const expectedSecret = process.env.WEBHOOK_SECRET
        if (expectedSecret && secret !== expectedSecret) {
            logger.error('Webhook security violation: Invalid secret key', undefined, { module: 'webhook' })
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Ignore non-message events
        if (body.event !== 'message') {
            return NextResponse.json({ success: true, ignored: true })
        }

        const payload = body.payload
        const agentId = body.sessionId ? parseInt(body.sessionId) : 1
        console.log(`[Webhook] Resolved Agent ID: ${agentId} (from sessionId: ${body.sessionId})`)

        // 2. DEDUPLICATION CHECK: Skip if already queued
        const messageId = payload?.id
        if (messageId) {
            const existingItem = await prisma.incomingQueue.findFirst({
                where: {
                    payload: { path: ['payload', 'id'], equals: messageId }
                }
            })
            if (existingItem) {
                logger.info('Duplicate message ignored', { messageId, existingItemId: existingItem.id, module: 'webhook' })
                return NextResponse.json({ success: true, ignored: true, reason: 'duplicate' })
            }
        }

        // 3. ADD TO QUEUE (fast operation)
        const queueItem = await prisma.incomingQueue.create({
            data: {
                payload: body as any,
                agentId,
                status: 'PENDING'
            }
        })

        logger.messageReceived(payload, agentId)
        console.log(`[Webhook] Message queued: ID ${queueItem.id}`)

        // 4. RETURN 200 IMMEDIATELY - CRON will process the queue
        return NextResponse.json({
            success: true,
            queued: true,
            queueId: queueItem.id
        })

    } catch (error: any) {
        logger.error('Webhook error', error, { module: 'webhook' })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
