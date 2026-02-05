import { NextResponse } from 'next/server'
import { cleanupOldLogs } from '@/lib/monitoring/log-aggregator'

export const dynamic = 'force-dynamic'

// Cron job pour nettoyer les vieux logs (appelé toutes les heures)
export async function GET(req: Request) {
  // Vérifier le secret pour sécuriser le cron
  const secretHeader = req.headers.get('x-internal-secret')
  if (secretHeader !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cleanedCount = await cleanupOldLogs()
    
    return NextResponse.json({
      success: true,
      cleanedCount,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('[Cron Cleanup] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
