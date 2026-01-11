import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processWhatsAppPayload } from '@/lib/services/whatsapp-processor'
import { logger, trace } from '@/lib/logger'

export async function POST(req: Request) {
    try {
        const body = await req.json()

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

        // 3. Fire-and-Forget Processing
        // We do NOT await this. We let it run in the background.
        // We capture errors to update the event status.
        // Run processing with trace context
        trace.runAsync(traceId, agentId, async () => {
            return processWhatsAppPayload(payload, agentId)
        })
            .then(async (result) => {
                await logger.info('Webhook event processed', { eventId: event.id, status: result.status, module: 'webhook' })
                await prisma.webhookEvent.update({
                    where: { id: event.id },
                    data: { status: 'PROCESSED', processedAt: new Date() }
                })
            })
            .catch(async (err) => {
                await logger.error('Webhook processing failed', err, { eventId: event.id, module: 'webhook' })
                await prisma.webhookEvent.update({
                    where: { id: event.id },
                    data: { status: 'FAILED', error: err.message, processedAt: new Date() }
                })
            })

        // 4. Immediate Response to Client (Prevent Timeout)
        return NextResponse.json({ success: true, queued: true, eventId: event.id })

    } catch (error: any) {
        await logger.error('Webhook error', error, { module: 'webhook' })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
