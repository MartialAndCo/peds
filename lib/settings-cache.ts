import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

interface CachedSettings {
    data: Record<string, string | boolean | number> | null
    expiry: number
}

// Global cache (persists across warm request invocations in serverless)
const settingsCache: CachedSettings = {
    data: null,
    expiry: 0
}

const CACHE_TTL = 60000 // 60 seconds

export const settingsService = {
    /**
     * Get all settings as a key-value object.
     * Uses in-memory cache with 60s TTL.
     */
    async getSettings() {
        console.log('[SettingsCache] Requesting settings (Time: ' + new Date().toISOString() + ')')
        // Return cached if valid
        if (Date.now() < settingsCache.expiry && settingsCache.data) {
            console.log('[SettingsCache] Returning cached settings')
            return settingsCache.data
        }

        try {
            console.log('[SettingsCache] Cache miss/expired. Fetching from DB...')
            const settingsList = await prisma.setting.findMany()
            console.log(`[SettingsCache] DB returned ${settingsList.length} settings`)
            const data = settingsList.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value
                return acc
            }, {})

            // Update cache
            settingsCache.data = data
            settingsCache.expiry = Date.now() + CACHE_TTL

            return data
        } catch (error: any) {
            console.error('Failed to fetch settings from DB', error)

            // Return stale cache if available, otherwise empty object to prevent crash
            if (settingsCache.data) return settingsCache.data
            return {}
        }
    },

    /**
     * Invalidate cache to force refresh on next call.
     * Useful when settings are updated via Admin UI.
     */
    invalidate() {
        settingsCache.data = null
        settingsCache.expiry = 0
    }
}
