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
        let agentId = 'default'
        let botId: string | undefined

        // Extract Bot ID from session ID (discord_{botId})
        if (body.sessionId && body.sessionId.toString().startsWith('discord_')) {
            botId = body.sessionId.toString().replace('discord_', '')
        }

        try {
            if (botId) {
                // Try to find assigned agent for this specific bot
                const discordBot = await prisma.discordBot.findUnique({
                    where: { id: botId }
                })
                if (discordBot?.agentId) {
                    agentId = discordBot.agentId
                    console.log(`[Discord Webhook] Resolved Agent ${agentId} for Bot ${botId}`)
                }
            }

            // Fallback 1: Use discord_agent_id from settings
            if (agentId === 'default') {
                const discordAgentSetting = await prisma.setting.findUnique({
                    where: { key: 'discord_agent_id' }
                })
                if (discordAgentSetting?.value) {
                    agentId = discordAgentSetting.value
                    console.log(`[Discord Webhook] Using discord_agent_id from settings: ${agentId}`)
                }
            }

            // Fallback 2: If still no agent, use first active agent
            if (agentId === 'default') {
                const firstAgent = await prisma.agent.findFirst({
                    where: { isActive: true }
                })
                if (firstAgent) {
                    agentId = firstAgent.id
                    console.log(`[Discord Webhook] No specific agent found, falling back to first active agent: ${agentId}`)
                } else {
                    console.warn('[Discord Webhook] CRITICAL: No active agents found in database!')
                }
            }
        } catch (e) {
            logger.warn('Failed to resolve Discord Bot agent', { error: e })
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
