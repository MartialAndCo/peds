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

        // 3. Sync Processing (Required for Serverless to guarantee execution)
        // We await this to ensure the lambda doesn't freeze the background task.
        try {
            await trace.runAsync(traceId, agentId, async () => {
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
        } catch (e) {
            console.error('Processing wrapper failed', e)
        }

        // 4. Response
        return NextResponse.json({ success: true, eventId: event.id })

    } catch (error: any) {
        logger.error('Webhook error', error, { module: 'webhook' })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
