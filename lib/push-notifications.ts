import webpush from 'web-push'
import { prisma } from '@/lib/prisma'
import { getNotificationPreferences, isNotificationEnabled, NotificationType } from './notification-preferences'

// Configure Web Push si les clés sont présentes
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:admin@example.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    )
}

export interface PushPayload {
    title: string
    body: string
    url?: string
    tag?: string
    icon?: string
    badge?: string
    requireInteraction?: boolean
}

/**
 * Envoie une notification push à tous les appareils abonnés
 * Vérifie d'abord si le type de notification est activé
 */
export async function sendPushNotificationToAll(
    payload: PushPayload,
    type?: NotificationType
): Promise<void> {
    try {
        // Si un type est spécifié, vérifier s'il est activé
        if (type) {
            const isEnabled = await isNotificationEnabled(type)
            if (!isEnabled) {
                console.log(`[Push] Notification type ${type} is disabled, skipping push`)
                return
            }
        }

        const subscriptions = await prisma.pushSubscription.findMany()

        console.log(`[Push] Attempting to send push notification to ${subscriptions.length} subscription(s)`)
        console.log(`[Push] Payload:`, payload)

        if (subscriptions.length === 0) {
            console.warn('[Push] No push subscriptions found in database')
            return
        }

        const notifications = subscriptions.map(sub => {
            console.log(`[Push] Sending to subscription ${sub.id} (endpoint: ${sub.endpoint.substring(0, 50)}...)`)
            return webpush.sendNotification({
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            }, JSON.stringify(payload))
                .then(() => {
                    console.log(`[Push] Successfully sent to subscription ${sub.id}`)
                })
                .catch(err => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        // Subscription expired/gone, cleanup
                        console.log(`[Push] Cleaning up expired subscription ${sub.id}`)
                        return prisma.pushSubscription.delete({ where: { id: sub.id } })
                    }
                    console.error(`[Push] Error sending to subscription ${sub.id}:`, err.message || err)
                })
        })

        await Promise.all(notifications)
        console.log('[Push] All push notifications processed')
    } catch (error) {
        console.error('[Push] Failed to send push notifications:', error)
    }
}

/**
 * Envoie une notification push pour une alerte CRITICAL
 */
export async function sendCriticalAlertPush(title: string, message: string, url?: string): Promise<void> {
    await sendPushNotificationToAll({
        title: `🚨 ${title}`,
        body: message.substring(0, 100),
        url: url || '/admin/system',
        tag: `critical-${Date.now()}`,
        icon: '/icon.png',
        badge: '/icon.png',
        requireInteraction: true
    }, 'notify_critical_errors')
}

/**
 * Envoie une notification push pour un nouveau paiement
 */
export async function sendPaymentClaimPush(contactName: string, amount: string, method: string): Promise<void> {
    await sendPushNotificationToAll({
        title: 'New Payment Claim',
        body: `${contactName} paid ${amount} with ${method}`,
        url: '/admin/notifications',
        tag: 'payment-claim',
        icon: '/icon.png',
        badge: '/icon.png'
    }, 'notify_payment_claim')
}

/**
 * Envoie une notification push pour une alerte Supervisor
 */
export async function sendSupervisorAlertPush(title: string, description: string, alertType: string, severity: string): Promise<void> {
    await sendPushNotificationToAll({
        title: `⚠️ ${title}`,
        body: description.substring(0, 100),
        url: `/admin/supervisor?alert=${alertType}`,
        tag: `supervisor-${alertType}`,
        icon: '/icon.png',
        badge: '/icon.png',
        requireInteraction: severity === 'CRITICAL'
    }, 'notify_supervisor_alerts')
}

/**
 * Envoie une notification push pour une erreur TTS
 */
export async function sendTTSFailurePush(title: string, message: string, url?: string): Promise<void> {
    await sendPushNotificationToAll({
        title: `🎤 ${title}`,
        body: message.substring(0, 100),
        url: url || '/admin/notifications',
        tag: 'tts-failure',
        icon: '/icon.png',
        badge: '/icon.png'
    }, 'notify_tts_failures')
}
