import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { aggregateLogs, persistLogs } from '@/lib/monitoring/log-aggregator'
import { LogSource, LogLevel } from '@/lib/monitoring/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    
    // Parse les paramètres
    const sourcesParam = searchParams.get('sources')
    const sources: LogSource[] = sourcesParam 
      ? sourcesParam.split(',') as LogSource[]
      : ['whatsapp', 'discord', 'nextjs']
    
    const levelParam = searchParams.get('level')
    const level: LogLevel[] | undefined = levelParam 
      ? levelParam.split(',') as LogLevel[]
      : undefined
    
    const sinceMinutes = parseInt(searchParams.get('since') || '60')
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000)
    
    const limit = parseInt(searchParams.get('limit') || '100')
    
    // Récupère les logs
    const { logs, stats } = await aggregateLogs({
      sources,
      level,
      since,
      limit
    })
    
    // Persiste les logs critiques en DB (fire and forget)
    persistLogs(logs).catch(console.error)
    
    return NextResponse.json({
      success: true,
      logs,
      stats,
      meta: {
        sources,
        since: since.toISOString(),
        fetchedAt: new Date().toISOString()
      }
    })
  } catch (error: any) {
    console.error('[Monitor API] Error fetching logs:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST pour marquer des logs comme lus
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { logIds, markAllRead } = body
    
    if (markAllRead) {
      const { prisma } = await import('@/lib/prisma')
      await prisma.systemLog.updateMany({
        where: { isRead: false },
        data: { 
          isRead: true, 
          readAt: new Date(),
          readBy: session.user?.email || 'unknown'
        }
      })
      return NextResponse.json({ success: true, message: 'All logs marked as read' })
    }
    
    if (logIds && Array.isArray(logIds)) {
      const { markLogsAsRead } = await import('@/lib/monitoring/log-aggregator')
      await markLogsAsRead(logIds, session.user?.email || 'unknown')
      return NextResponse.json({ success: true, message: `${logIds.length} logs marked as read` })
    }
    
    return NextResponse.json({ error: 'Missing logIds or markAllRead' }, { status: 400 })
  } catch (error: any) {
    console.error('[Monitor API] Error updating logs:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
