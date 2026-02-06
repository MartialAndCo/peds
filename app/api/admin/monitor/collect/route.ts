import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { aggregateLogs, persistLogs } from '@/lib/monitoring/log-aggregator'
import { prisma } from '@/lib/prisma'
import { sendCriticalAlertPush } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'

// Endpoint pour collecter les logs et créer des notifications (appelé par cron)
export async function POST(req: Request) {
  // Vérifier l'auth soit par session soit par secret header (pour le cron)
  const session = await getServerSession(authOptions)
  const secretHeader = req.headers.get('x-internal-secret')
  const isCron = secretHeader === process.env.WEBHOOK_SECRET
  
  if (!session && !isCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Récupère les logs des 5 dernières minutes
    const since = new Date(Date.now() - 5 * 60 * 1000)
    
    const { logs, stats } = await aggregateLogs({
      sources: ['whatsapp', 'discord', 'nextjs'],
      since,
      limit: 100
    })
    
    // Persiste tous les logs
    await persistLogs(logs)
    
    // Crée des notifications pour les erreurs CRITICAL non encore notifiées
    const criticalLogs = logs.filter(log => log.level === 'CRITICAL')
    let notificationsCreated = 0
    
    for (const log of criticalLogs) {
      // Vérifie si une notification existe déjà pour ce log
      const existingLog = await prisma.systemLog.findUnique({
        where: { id: log.id }
      })
      
      if (existingLog?.notificationCreated) continue
      
      // Crée une notification
      await prisma.notification.create({
        data: {
          title: `🚨 CRITICAL: ${log.category}`,
          message: `[${log.source.toUpperCase()}] ${log.message}`,
          type: 'SYSTEM_ERROR',
          entityId: log.id,
          metadata: {
            logId: log.id,
            source: log.source,
            service: log.service,
            category: log.category,
            context: log.context
          },
          isRead: false
        }
      })
      
      // Envoie une notification push
      await sendCriticalAlertPush(
        `CRITICAL: ${log.category}`,
        `[${log.source.toUpperCase()}] ${log.message}`,
        '/admin/system'
      )
      
      // Marque le log comme notifié
      await prisma.systemLog.update({
        where: { id: log.id },
        data: { notificationCreated: true }
      })
      
      notificationsCreated++
    }
    
    // Nettoie les vieux logs (TTL)
    const { cleanupOldLogs } = await import('@/lib/monitoring/log-aggregator')
    const cleanedCount = await cleanupOldLogs()
    
    return NextResponse.json({
      success: true,
      collected: logs.length,
      critical: criticalLogs.length,
      notificationsCreated,
      cleanedCount,
      stats
    })
  } catch (error: any) {
    console.error('[Monitor Collect] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// GET pour vérifier le statut
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await prisma.systemLog.groupBy({
      by: ['level', 'source'],
      _count: { id: true },
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    })
    
    const unreadCount = await prisma.systemLog.count({
      where: { isRead: false }
    })
    
    return NextResponse.json({
      success: true,
      stats,
      unreadCount,
      last24h: stats.reduce((acc, s) => acc + s._count.id, 0)
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
