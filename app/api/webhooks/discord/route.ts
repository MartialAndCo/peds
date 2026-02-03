import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * Discord Webhook Handler
 * 
 * Receives messages from Discord Service and queues them for async processing.
 * Returns 200 immediately to prevent timeout issues.
 * 
 * Processing happens via CRON: /api/cron/process-incoming
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        console.log('[Discord Webhook] Received Payload:', JSON.stringify(body, null, 2))

        // 1. Security Check
        const secret = req.headers.get('x-internal-secret')
        const expectedSecret = process.env.WEBHOOK_SECRET
        if (expectedSecret && secret !== expectedSecret) {
            logger.error('Discord webhook security violation: Invalid secret key', undefined, { module: 'discord-webhook' })
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Ignore non-message events
        if (body.event !== 'message') {
            return NextResponse.json({ success: true, ignored: true })
        }

        const payload = body.payload

        // Resolve Agent ID:
        // Priority 1: System Settings (dynamic configuration via UI)
        // Priority 2: Payload session ID (fallback)
        // Priority 3: Default
        let agentId = 'default'

        try {
            const settings = await prisma.systemSettings.findUnique({
                where: { id: 'default' }
            })
            if (settings?.discordAgentId) {
                agentId = settings.discordAgentId
                console.log(`[Discord Webhook] Using configured Agent ID from Settings: ${agentId}`)
            } else if (body.sessionId && body.sessionId.toString().startsWith('discord_')) {
                // ... Fallback logic ...
                agentId = body.sessionId.toString().replace('discord_', '')
            }
        } catch (e) {
            logger.warn('Failed to fetch system settings', { error: e })
        }

        console.log(`[Discord Webhook] Final Resolved Agent ID: ${agentId}`)

        // 2. DEDUPLICATION CHECK
        const messageId = payload?.id
        if (messageId) {
            const existingItem = await prisma.incomingQueue.findFirst({
                where: {
                    payload: { path: ['payload', 'id'], equals: messageId }
                }
            })
            if (existingItem) {
                logger.info('Duplicate Discord message ignored', { messageId, existingItemId: existingItem.id, module: 'discord-webhook' })
                return NextResponse.json({ success: true, ignored: true, reason: 'duplicate' })
            }
        }

        // 3. Normalize payload to match WhatsApp format
        // This allows the processor to handle Discord messages with minimal changes
        const normalizedPayload = {
            ...body,
            payload: {
                ...payload,
                // Discord User ID as phone equivalent
                from: `DISCORD_${payload.from}@discord`,
                // Keep original Discord ID for reference
                _data: {
                    ...payload._data,
                    discordUserId: payload.from,
                    platform: 'discord'
                }
            }
        }

        // 4. ADD TO QUEUE
        const queueItem = await prisma.incomingQueue.create({
            data: {
                payload: normalizedPayload as any,
                agentId,
                status: 'PENDING'
            }
        })

        console.log(`[Discord Webhook] Message queued: ID ${queueItem.id}`)

        return NextResponse.json({
            success: true,
            queued: true,
            queueId: queueItem.id
        })

    } catch (error: any) {
        logger.error('Discord webhook error', error, { module: 'discord-webhook' })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
