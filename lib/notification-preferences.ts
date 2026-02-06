import { prisma } from '@/lib/prisma'

export type NotificationType = 
    | 'notify_payment_claim'
    | 'notify_critical_errors'
    | 'notify_supervisor_alerts'
    | 'notify_tts_failures'

interface NotificationPreferences {
    notify_payment_claim: boolean
    notify_critical_errors: boolean
    notify_supervisor_alerts: boolean
    notify_tts_failures: boolean
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
    notify_payment_claim: true,
    notify_critical_errors: true,
    notify_supervisor_alerts: true,
    notify_tts_failures: true
}

/**
 * Récupère les préférences de notification depuis les settings
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
    try {
        const settings = await prisma.setting.findMany({
            where: {
                key: {
                    in: [
                        'notify_payment_claim',
                        'notify_critical_errors',
                        'notify_supervisor_alerts',
                        'notify_tts_failures'
                    ]
                }
            }
        })

        const preferences = { ...DEFAULT_PREFERENCES }
        
        for (const setting of settings) {
            if (setting.key in DEFAULT_PREFERENCES) {
                preferences[setting.key as NotificationType] = setting.value !== 'false'
            }
        }

        return preferences
    } catch (error) {
        console.error('[NotificationPreferences] Failed to get preferences:', error)
        return DEFAULT_PREFERENCES
    }
}

/**
 * Vérifie si un type de notification est activé
 */
export async function isNotificationEnabled(type: NotificationType): Promise<boolean> {
    try {
        const setting = await prisma.setting.findUnique({
            where: { key: type }
        })

        // Si pas de setting, utiliser la valeur par défaut
        if (!setting) {
            return DEFAULT_PREFERENCES[type]
        }

        return setting.value !== 'false'
    } catch (error) {
        console.error(`[NotificationPreferences] Failed to check ${type}:`, error)
        return DEFAULT_PREFERENCES[type]
    }
}

/**
 * Met à jour une préférence de notification
 */
export async function setNotificationPreference(
    type: NotificationType,
    enabled: boolean
): Promise<void> {
    try {
        await prisma.setting.upsert({
            where: { key: type },
            update: { value: enabled ? 'true' : 'false' },
            create: { key: type, value: enabled ? 'true' : 'false' }
        })
    } catch (error) {
        console.error(`[NotificationPreferences] Failed to set ${type}:`, error)
        throw error
    }
}

/**
 * Réinitialise toutes les préférences aux valeurs par défaut
 */
export async function resetNotificationPreferences(): Promise<void> {
    try {
        const updates = Object.entries(DEFAULT_PREFERENCES).map(([key, value]) =>
            prisma.setting.upsert({
                where: { key },
                update: { value: value ? 'true' : 'false' },
                create: { key, value: value ? 'true' : 'false' }
            })
        )

        await prisma.$transaction(updates)
    } catch (error) {
        console.error('[NotificationPreferences] Failed to reset preferences:', error)
        throw error
    }
}
