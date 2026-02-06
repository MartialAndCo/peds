import { prisma } from '@/lib/prisma'
import { sendCriticalAlertPush } from '@/lib/push-notifications'

/**
 * Log une erreur système dans la DB pour monitoring
 * À utiliser quand une erreur critique survient (connexion perdue, etc.)
 */
export async function logSystemError(
  source: 'whatsapp' | 'discord' | 'nextjs' | 'cron',
  level: 'CRITICAL' | 'ERROR' | 'WARN',
  message: string,
  context?: string,
  service?: string
): Promise<void> {
  try {
    const id = `${source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    
    await prisma.systemLog.create({
      data: {
        id,
        source,
        level,
        category: 'connection',
        service: service || source,
        message,
        context,
        isRead: false,
        notificationCreated: level === 'CRITICAL', // Crée notification si CRITICAL
        expiresAt
      }
    })
    
    // Si CRITICAL, créer aussi une notification pour le PWA + envoyer push
    if (level === 'CRITICAL') {
      await prisma.notification.create({
        data: {
          title: `🚨 CRITICAL: ${source}`,
          message: message,
          type: 'SYSTEM_ERROR',
          entityId: id,
          metadata: { source, service, context },
          isRead: false
        }
      })
      
      // Envoyer aussi une notification push
      await sendCriticalAlertPush(
        `CRITICAL: ${source}`,
        message,
        '/admin/system'
      )
    }
  } catch (e) {
    // Si on arrive pas à logger en DB, logger en console au moins
    console.error('[SystemLogger] Failed to persist error:', e)
  }
}

/**
 * Log une erreur de connexion WhatsApp
 */
export async function logWhatsAppError(error: any, context?: string): Promise<void> {
  const message = error?.code === 'ECONNREFUSED' 
    ? `WhatsApp server unreachable (${error.code})`
    : `WhatsApp error: ${error?.message || 'Unknown error'}`
    
  await logSystemError('whatsapp', 'CRITICAL', message, context || JSON.stringify(error), 'whatsapp')
}
