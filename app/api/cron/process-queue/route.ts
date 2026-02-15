import { NextResponse } from 'next/server'
import { queueService } from '@/lib/services/queue-service'

// Timestamp-based guard: prevents promise stacking but auto-expires after 2 min
let processingStartedAt: number | null = null
const MAX_PROCESSING_MS = 120_000 // 2 minutes hard limit

// Répond immédiatement, traite en arrière-plan
export async function GET(req: Request) {
    try {
        console.log('[Cron] Triggered process-queue endpoint')

        // Check if another processing is still running AND hasn't timed out
        if (processingStartedAt) {
            const elapsed = Date.now() - processingStartedAt
            if (elapsed < MAX_PROCESSING_MS) {
                console.log(`[Cron] Processing active (${Math.round(elapsed / 1000)}s). Skipping.`)
                return NextResponse.json({
                    success: true,
                    message: 'Processing active, skipped',
                    timestamp: new Date().toISOString()
                })
            }
            console.warn(`[Cron] ⚠️ Previous processing timed out after ${Math.round(elapsed / 1000)}s. Forcing new run.`)
        }

        // Lancer le traitement en arrière-plan (sans await)
        // Pour éviter le timeout Amplify (10s max)
        processingStartedAt = Date.now()

        queueService.processPendingMessages().then(result => {
            console.log(`[Cron] process-queue complete. Processed: ${result.processed}`)
        }).catch(error => {
            console.error('[Cron] Error in background processing:', error)
        }).finally(() => {
            processingStartedAt = null
        })

        // Répondre immédiatement
        return NextResponse.json({
            success: true,
            message: 'Processing started in background',
            timestamp: new Date().toISOString()
        })

    } catch (error: any) {
        console.error('[Cron] Fatal Error:', error)
        processingStartedAt = null
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
