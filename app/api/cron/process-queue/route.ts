import { NextResponse } from 'next/server'
import { queueService } from '@/lib/services/queue-service'

// This route should be triggered by Vercel Cron (e.g., every 10 mins)
export async function GET(req: Request) {
    try {
        // Authenticate Cron (Optional but recommended)
        /*
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new Response('Unauthorized', { status: 401 });
        }
        */

        console.log('[Cron] Triggered process-queue endpoint')
        const result = await queueService.processPendingMessages()
        console.log(`[Cron] process-queue complete. Processed: ${result.processed}`)

        return NextResponse.json({
            success: true,
            ...result
        })

    } catch (error: any) {
        console.error('[Cron] Fatal Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

