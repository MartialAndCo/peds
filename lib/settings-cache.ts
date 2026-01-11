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
        // Return cached if valid
        if (Date.now() < settingsCache.expiry && settingsCache.data) {
            return settingsCache.data
        }

        try {
            const settingsList = await prisma.setting.findMany()
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
