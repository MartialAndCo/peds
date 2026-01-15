import { NextResponse } from 'next/server'
import { memoryExtractionService } from '@/lib/services/memory-extraction'

/**
 * CRON Endpoint: Extract Memories
 * 
 * Analyzes conversations and extracts important facts/anecdotes to Mem0.
 * Should be triggered every 6 hours via external CRON.
 */
export async function GET(request: Request) {
    // Optional: Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[CRON] Unauthorized memory extraction attempt')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CRON] Starting memory extraction job...')

    try {
        const result = await memoryExtractionService.runExtraction()

        console.log(`[CRON] Memory extraction complete. Processed: ${result.processed}, Facts: ${result.factsExtracted}`)

        return NextResponse.json({
            success: true,
            processed: result.processed,
            factsExtracted: result.factsExtracted,
            timestamp: new Date().toISOString()
        })
    } catch (error: any) {
        console.error('[CRON] Memory extraction failed:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}

// Also allow POST for manual triggers
export async function POST(request: Request) {
    return GET(request)
}
