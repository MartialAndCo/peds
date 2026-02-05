import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { LogSource, LogLevel } from '@/lib/monitoring/types'
import { parseLogLine, generateLogId } from '@/lib/monitoring/error-patterns'

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
    const sources = sourcesParam 
      ? sourcesParam.split(',') as LogSource[]
      : ['whatsapp', 'nextjs']
    
    const levelParam = searchParams.get('level')
    const levels = levelParam 
      ? levelParam.split(',') as LogLevel[]
      : undefined
    
    const sinceMinutes = parseInt(searchParams.get('since') || '60')
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000)
    
    const limit = parseInt(searchParams.get('limit') || '100')
    
    // Récupère les logs de la DB (SystemLog)
    const dbLogs = await prisma.systemLog.findMany({
      where: {
        source: { in: sources },
        ...(levels && { level: { in: levels } }),
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })
    
    // Récupère les logs WhatsApp depuis Baileys (aussi si on demande amplify car ils peuvent contenir des logs amplify)
    let baileysLogs: any[] = []
    if (sources.includes('whatsapp') || sources.includes('amplify')) {
      const result = await whatsapp.adminLogs(200)
      if (result.success && result.lines) {
        // Parse les logs Baileys
        baileysLogs = result.lines
          .map((line: string) => {
            const parsed = parseLogLine(line, 'whatsapp')
            if (!parsed) return null
            // Si le service est amplify, utiliser amplify comme source aussi
            const isAmplify = parsed.service === 'amplify'
            return {
              id: generateLogId(isAmplify ? 'amplify' : 'whatsapp', line, new Date()),
              timestamp: new Date().toISOString(), // On n'a pas le timestamp exact
              source: isAmplify ? 'amplify' : 'whatsapp',
              service: parsed.service,
              level: parsed.level,
              category: parsed.category,
              message: parsed.message,
              context: line,
              isRead: true // Logs Baileys considérés comme lus par défaut
            }
          })
          .filter(Boolean)
      }
    }
    
    // Merge et déduplique
    const allLogs = [...dbLogs.map(l => ({
      id: l.id,
      timestamp: l.createdAt.toISOString(),
      source: l.source,
      service: l.service,
      level: l.level as LogLevel,
      category: l.category,
      message: l.message,
      context: l.context,
      isRead: l.isRead
    })), ...baileysLogs]
    
    // Filtre par niveau si spécifié
    let filteredLogs = levels 
      ? allLogs.filter(l => levels.includes(l.level))
      : allLogs
    
    // Trie par date
    filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    // Limite
    filteredLogs = filteredLogs.slice(0, limit)
    
    // Stats
    const stats = {
      total: filteredLogs.length,
      bySource: {
        whatsapp: filteredLogs.filter(l => l.source === 'whatsapp').length,
        discord: filteredLogs.filter(l => l.source === 'discord').length,
        nextjs: filteredLogs.filter(l => l.source === 'nextjs').length,
        cron: filteredLogs.filter(l => l.source === 'cron').length,
        amplify: filteredLogs.filter(l => l.source === 'amplify').length
      },
      byLevel: {
        CRITICAL: filteredLogs.filter(l => l.level === 'CRITICAL').length,
        ERROR: filteredLogs.filter(l => l.level === 'ERROR').length,
        WARN: filteredLogs.filter(l => l.level === 'WARN').length,
        INFO: filteredLogs.filter(l => l.level === 'INFO').length
      },
      criticalCount: filteredLogs.filter(l => l.level === 'CRITICAL').length,
      unreadCount: filteredLogs.filter(l => !l.isRead).length,
      lastUpdated: new Date()
    }
    
    return NextResponse.json({
      success: true,
      logs: filteredLogs,
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
