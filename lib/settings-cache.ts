import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

interface CachedSettings {
    data: Record<string, string | boolean | number> | null
    expiry: number
}

// Cache PAR AGENT (pas global) pour éviter les mélanges de personas
const agentSettingsCache: Map<string, CachedSettings> = new Map()

const CACHE_TTL = 60000 // 60 seconds

export const settingsService = {
    /**
     * Get all GLOBAL settings as a key-value object.
     * Uses in-memory cache with 60s TTL.
     * 
     * ⚠️ WARNING: These are GLOBAL settings only. For agent-specific settings,
     * use getAgentSettings() instead to avoid persona mixing bugs.
     */
    async getSettings() {
        console.log('[SettingsCache] Requesting GLOBAL settings (Time: ' + new Date().toISOString() + ')')
        
        // Utiliser une clé spéciale pour les settings globaux
        const globalCacheKey = '__GLOBAL__'
        const cached = agentSettingsCache.get(globalCacheKey)
        
        if (cached && Date.now() < cached.expiry && cached.data) {
            console.log('[SettingsCache] Returning cached GLOBAL settings')
            return cached.data
        }

        try {
            console.log('[SettingsCache] Cache miss/expired. Fetching GLOBAL from DB...')
            const settingsList = await prisma.setting.findMany()
            console.log(`[SettingsCache] DB returned ${settingsList.length} global settings`)
            const data = settingsList.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value
                return acc
            }, {})

            // Update cache
            agentSettingsCache.set(globalCacheKey, {
                data,
                expiry: Date.now() + CACHE_TTL
            })

            return data
        } catch (error: any) {
            console.error('Failed to fetch global settings from DB', error.message)

            // Return stale cache if available, otherwise empty object to prevent crash
            if (cached?.data) return cached.data
            return {}
        }
    },

    /**
     * Get AGENT-SPECIFIC settings merged with global settings.
     * CRITICAL: This is the method to use in the SWARM to avoid persona mixing.
     * 
     * Priority: Agent settings > Global settings
     * Cache is per-agent to prevent cross-contamination.
     */
    async getAgentSettings(agentId: string) {
        console.log(`[SettingsCache] Requesting settings for agent: ${agentId}`)
        
        const cached = agentSettingsCache.get(agentId)
        
        if (cached && Date.now() < cached.expiry && cached.data) {
            console.log(`[SettingsCache] Returning cached settings for agent ${agentId}`)
            return cached.data
        }

        try {
            console.log(`[SettingsCache] Cache miss for agent ${agentId}. Fetching from DB...`)
            
            // 1. Get global settings
            const globalSettingsList = await prisma.setting.findMany()
            const globalSettings = globalSettingsList.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value
                return acc
            }, {})
            
            // 2. Get agent-specific settings (from AgentSetting table)
            const agentSettingsList = await prisma.agentSetting.findMany({
                where: { agentId }
            })
            const agentSpecificSettings = agentSettingsList.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value
                return acc
            }, {})
            
            // 3. Merge: Agent settings override global settings
            const mergedSettings = {
                ...globalSettings,
                ...agentSpecificSettings,
                _agentId: agentId // Tag with agent ID for debugging
            }
            
            console.log(`[SettingsCache] Agent ${agentId}: ${agentSettingsList.length} agent-specific settings, ${globalSettingsList.length} global settings`)

            // Update cache for this specific agent
            agentSettingsCache.set(agentId, {
                data: mergedSettings,
                expiry: Date.now() + CACHE_TTL
            })

            return mergedSettings
        } catch (error: any) {
            console.error(`Failed to fetch settings for agent ${agentId}`, error.message)

            // Return stale cache if available
            if (cached?.data) return cached.data
            
            // Fallback to global settings
            return this.getSettings()
        }
    },

    /**
     * Invalidate ALL caches (use when settings are updated via Admin UI).
     * This clears both global and all agent-specific caches.
     */
    invalidate() {
        console.log('[SettingsCache] Invalidating ALL caches (global + all agents)')
        agentSettingsCache.clear()
    },

    /**
     * Invalidate cache for a specific agent only.
     * Use this when agent-specific settings are updated.
     */
    invalidateAgent(agentId: string) {
        console.log(`[SettingsCache] Invalidating cache for agent ${agentId}`)
        agentSettingsCache.delete(agentId)
        agentSettingsCache.delete('__GLOBAL__')
    },

    /**
     * Get cache stats for debugging.
     */
    getCacheStats() {
        return {
            cachedAgentCount: agentSettingsCache.size,
            cachedAgents: Array.from(agentSettingsCache.keys()),
            cacheTTL: CACHE_TTL
        }
    }
}
