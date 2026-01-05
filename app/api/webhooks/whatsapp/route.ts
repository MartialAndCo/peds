import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processWhatsAppPayload } from '@/lib/services/whatsapp-processor'

export async function POST(req: Request) {
    try {
        const body = await req.json()

        // 1. Security Check
        const secret = req.headers.get('x-internal-secret')
        const expectedSecret = process.env.WEBHOOK_SECRET
        if (expectedSecret && secret !== expectedSecret) {
            console.error('[Webhook] Security Violation: Invalid Secret Key')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (body.event !== 'message') {
            return NextResponse.json({ success: true, ignored: true })
        }

        const payload = body.payload
        const agentId = body.sessionId ? parseInt(body.sessionId) : 1

        // 2. Async Ingestion (Log to DB)
        // We log the event synchronously to ensure durability
        const event = await prisma.webhookEvent.create({
            data: {
                source: 'whatsapp',
                payload: body as any, // Cast JSON
                status: 'PENDING'
            }
        })

        console.log(`[Webhook] Event Received & Queued (ID: ${event.id})`)

        // 3. Fire-and-Forget Processing
        // We do NOT await this. We let it run in the background.
        // We capture errors to update the event status.
        processWhatsAppPayload(payload, agentId)
            .then(async (result) => {
                console.log(`[Webhook] Background Processed: ${result.status}`)
                await prisma.webhookEvent.update({
                    where: { id: event.id },
                    data: { status: 'PROCESSED', processedAt: new Date() }
                })
            })
            .catch(async (err) => {
                console.error(`[Webhook] Background Logic Failed:`, err)
                await prisma.webhookEvent.update({
                    where: { id: event.id },
                    data: { status: 'FAILED', error: err.message, processedAt: new Date() }
                })
            })

        // 4. Immediate Response to Client (Prevent Timeout)
        return NextResponse.json({ success: true, queued: true, eventId: event.id })

    } catch (error: any) {
        console.error('Webhook Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
