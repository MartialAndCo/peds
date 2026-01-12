import { NextRequest, NextResponse } from 'next/server'
import { messageRecoveryService } from '@/lib/services/message-recovery'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for recovery

/**
 * Cron endpoint for message recovery
 * 
 * This should be called every 2-3 minutes by a cron service.
 * It scans for "orphan" messages - contact messages that never got an AI response
 * due to bugs, timeouts, or other failures.
 * 
 * Example cron setup (Vercel, Railway, etc.):
 * GET /api/cron/process-recovery every 3 minutes
 */
export async function GET(request: NextRequest) {
    const startTime = Date.now()

    try {
        // Verify cron secret if configured
        const cronSecret = process.env.CRON_SECRET
        const authHeader = request.headers.get('authorization')

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log('[Cron/Recovery] Starting orphan message recovery...')

        const result = await messageRecoveryService.recoverOrphanMessages()

        const duration = Date.now() - startTime

        logger.info('Recovery cron completed', {
            module: 'cron',
            recovered: result.recovered,
            duration: `${duration}ms`
        })

        return NextResponse.json({
            success: true,
            recovered: result.recovered,
            details: result.details,
            duration: `${duration}ms`
        })

    } catch (error: any) {
        console.error('[Cron/Recovery] Error:', error)
        logger.error('Recovery cron failed', error, { module: 'cron' })

        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
