import { NextResponse } from 'next/server'
import { queueService } from '@/lib/services/queue-service'

// Répond immédiatement, traite en arrière-plan
export async function GET(req: Request) {
    try {
        console.log('[Cron] Triggered process-queue endpoint')
        
        // Lancer le traitement en arrière-plan (sans await)
        // Pour éviter le timeout Amplify (10s max)
        queueService.processPendingMessages().then(result => {
            console.log(`[Cron] process-queue complete. Processed: ${result.processed}`)
        }).catch(error => {
            console.error('[Cron] Error in background processing:', error)
        })
        
        // Répondre immédiatement
        return NextResponse.json({
            success: true,
            message: 'Processing started in background',
            timestamp: new Date().toISOString()
        })

    } catch (error: any) {
        console.error('[Cron] Fatal Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
