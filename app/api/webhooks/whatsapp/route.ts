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

        // Handle Reaction Events (for payment claim confirmation)
        if (body.event === 'message.reaction' || body.event === 'messages.reaction') {
            try {
                const { handlePaymentClaimReaction } = require('@/lib/services/payment-claim-handler')
                const reactionData = body.payload || body
                const messageId = reactionData.key?.id || reactionData.messageId || reactionData.id
                const reaction = reactionData.reaction?.text || reactionData.text || reactionData.emoji
                const agentId = body.sessionId ? parseInt(body.sessionId) : 1

                // Get settings
                const { settingsService } = require('@/lib/settings-cache')
                const settings = await settingsService.getSettings()

                if (messageId && reaction) {
                    const handled = await handlePaymentClaimReaction(messageId, reaction, settings, agentId)
                    if (handled) {
                        logger.info('Payment claim reaction processed', { messageId, reaction, module: 'webhook' })
                    }
                }
            } catch (e: any) {
                console.error('[Webhook] Reaction handling failed:', e.message)
            }
            return NextResponse.json({ success: true, type: 'reaction' })
        }

        // Ignore non-message events
        if (body.event !== 'message') {
            return NextResponse.json({ success: true, ignored: true })
        }


        const payload = body.payload
        const payload = body.payload
        let agentId = 1 // Default

        if (body.sessionId) {
            // Check if it's a UUID session (starts with session_)
            if (body.sessionId.toString().startsWith('session_')) {
                const setting = await prisma.agentSetting.findFirst({
                    where: { key: 'waha_id', value: body.sessionId }
                })
                if (setting) agentId = setting.agentId
                else console.warn(`[Webhook] Could not resolve Agent ID for uuid session: ${body.sessionId}`)
            } else {
                // Legacy Integer ID
                agentId = parseInt(body.sessionId) || 1
            }
        }

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
