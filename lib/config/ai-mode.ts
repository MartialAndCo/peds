// Configuration AI Mode - SWARM-ONLY (Legacy Director Archived)
// MIGRATION: 2026-02-07 - Director completement desactive

export type AIMode = 'SWARM'

class AIConfig {
    private _mode: AIMode = 'SWARM'

    get mode(): AIMode {
        // 🔒 SWARM-ONLY: Director archive
        return 'SWARM'
    }

    async init(): Promise<void> {
        // Already initialized - SWARM mode is always active
        return Promise.resolve()
    }

    async setMode(mode: AIMode): Promise<void> {
        // No-op: SWARM mode is locked
        console.log('[AIConfig] Attempted to set mode to', mode, '- SWARM is locked')
        return Promise.resolve()
    }

    isClassic(): boolean {
        // 🔒 Director desactive
        return false
    }

    isSwarm(): boolean {
        // ✅ Seul mode actif
        return true
    }
}

export const aiConfig = new AIConfig()
