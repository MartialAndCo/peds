import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processWhatsAppPayload } from '@/lib/services/whatsapp-processor'
import { logger, trace } from '@/lib/logger'

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

        if (body.event !== 'message') {
            return NextResponse.json({ success: true, ignored: true })
        }

        const payload = body.payload
        const agentId = body.sessionId ? parseInt(body.sessionId) : 1
        console.log(`[Webhook] Resolved Agent ID: ${agentId} (from sessionId: ${body.sessionId})`)

        // DEDUPLICATION CHECK: Skip if this message ID was already processed
        const messageId = payload?.id
        if (messageId) {
            const existingEvent = await prisma.webhookEvent.findFirst({
                where: {
                    source: 'whatsapp',
                    status: { in: ['PENDING', 'PROCESSED'] },
                    payload: { path: ['payload', 'id'], equals: messageId }
                }
            })
            if (existingEvent) {
                logger.info('Duplicate message ignored', { messageId, existingEventId: existingEvent.id, module: 'webhook' })
                return NextResponse.json({ success: true, ignored: true, reason: 'duplicate' })
            }
        }

        // Generate trace ID for this message flow
        const traceId = trace.generate()

        // 2. Async Ingestion (Log to DB)
        // We log the event synchronously to ensure durability
        const event = await prisma.webhookEvent.create({
            data: {
                source: 'whatsapp',
                payload: body as any, // Cast JSON
                status: 'PENDING'
            }
        })

        logger.messageReceived(payload, agentId)

        // 3. EARLY RESPONSE - Return 200 immediately to prevent Baileys timeout
        // The processing continues in background via fire-and-forget
        // This is safe because we've already logged the event to DB

        // Fire-and-forget processing (no await)
        trace.runAsync(traceId, agentId, async () => {
            return await processWhatsAppPayload(payload, agentId)
        })
            .then(async (result) => {
                logger.info('Webhook event processed', { eventId: event.id, status: result.status, module: 'webhook' })
                await prisma.webhookEvent.update({
                    where: { id: event.id },
                    data: { status: 'PROCESSED', processedAt: new Date() }
                })
            })
            .catch(async (err) => {
                logger.error('Webhook processing failed', err, { eventId: event.id, module: 'webhook' })
                await prisma.webhookEvent.update({
                    where: { id: event.id },
                    data: { status: 'FAILED', error: err.message, processedAt: new Date() }
                })
            })

        // 4. Response - Return immediately (processing continues in background)
        return NextResponse.json({ success: true, eventId: event.id })

    } catch (error: any) {
        logger.error('Webhook error', error, { module: 'webhook' })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
