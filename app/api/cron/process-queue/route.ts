import { NextResponse } from 'next/server'
import { queueService } from '@/lib/services/queue-service'
import { prisma } from '@/lib/prisma'

// Track if processing is already running in this instance
// Note: This only works within a single instance. For multi-instance deployments,
// we rely on database-level locking in queueService.processPendingMessages()
let isProcessing = false

// Répond immédiatement, traite en arrière-plan
export async function GET(req: Request) {
    try {
        console.log('[Cron] Triggered process-queue endpoint')
        
        // Check if another instance is already processing
        // We check for items in PROCESSING state that were updated recently (< 30 seconds)
        const recentProcessing = await prisma.messageQueue.findFirst({
            where: {
                status: 'PROCESSING',
                updatedAt: { gt: new Date(Date.now() - 30000) } // Updated in last 30s
            }
        })
        
        if (recentProcessing && isProcessing) {
            console.log('[Cron] Processing already active (both local flag and DB indicate activity). Skipping.')
            return NextResponse.json({
                success: true,
                message: 'Processing already active, skipped',
                timestamp: new Date().toISOString()
            })
        }
        
        // Lancer le traitement en arrière-plan (sans await)
        // Pour éviter le timeout Amplify (10s max)
        isProcessing = true
        
        queueService.processPendingMessages().then(result => {
            console.log(`[Cron] process-queue complete. Processed: ${result.processed}`)
        }).catch(error => {
            console.error('[Cron] Error in background processing:', error)
        }).finally(() => {
            isProcessing = false
        })
        
        // Répondre immédiatement
        return NextResponse.json({
            success: true,
            message: 'Processing started in background',
            timestamp: new Date().toISOString()
        })

    } catch (error: any) {
        console.error('[Cron] Fatal Error:', error)
        isProcessing = false
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
