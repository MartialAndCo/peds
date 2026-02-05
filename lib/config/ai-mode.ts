// Configuration AI Mode - Stocké en DB
import { prisma } from '@/lib/prisma'
import { settingsService } from '@/lib/settings-cache'

export type AIMode = 'CLASSIC' | 'SWARM'

class AIConfig {
    private _mode: AIMode = 'CLASSIC'
    private _initialized = false

    get mode(): AIMode {
        return this._mode
    }

    async init() {
        if (this._initialized) return
        
        // Lire depuis la DB
        const settings = await settingsService.getSettings()
        const dbMode = settings['ai_mode'] as AIMode
        
        if (dbMode && ['CLASSIC', 'SWARM'].includes(dbMode)) {
            this._mode = dbMode
            console.log(`[AI Mode] Loaded from DB: ${dbMode}`)
        } else {
            // Fallback sur env
            const envMode = process.env.AI_MODE as AIMode
            if (envMode && ['CLASSIC', 'SWARM'].includes(envMode)) {
                this._mode = envMode
                console.log(`[AI Mode] Loaded from ENV: ${envMode}`)
            }
        }
        
        this._initialized = true
    }

    async setMode(mode: AIMode) {
        this._mode = mode
        
        // Sauvegarder en DB
        await prisma.setting.upsert({
            where: { key: 'ai_mode' },
            update: { value: mode },
            create: { key: 'ai_mode', value: mode }
        })
        
        // Invalider le cache
        settingsService.invalidate()
        
        console.log(`[AI Mode] Saved to DB: ${mode}`)
    }

    isClassic(): boolean {
        return this._mode === 'CLASSIC'
    }

    isSwarm(): boolean {
        return this._mode === 'SWARM'
    }
}

export const aiConfig = new AIConfig()

// Auto-init au chargement
if (typeof process !== 'undefined') {
    aiConfig.init().catch(console.error)
}
