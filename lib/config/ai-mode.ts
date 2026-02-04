// Configuration pour switcher entre les modes IA
export type AIMode = 'CLASSIC' | 'SWARM'

class AIConfig {
    private _mode: AIMode = 'CLASSIC'

    get mode(): AIMode {
        return this._mode
    }

    setMode(mode: AIMode) {
        this._mode = mode
        console.log(`[AI Mode] Switched to: ${mode}`)
    }

    isClassic(): boolean {
        return this._mode === 'CLASSIC'
    }

    isSwarm(): boolean {
        return this._mode === 'SWARM'
    }
}

export const aiConfig = new AIConfig()

// Initialisation depuis les variables d'environnement
if (typeof process !== 'undefined' && process.env.AI_MODE) {
    const envMode = process.env.AI_MODE as AIMode
    if (['CLASSIC', 'SWARM'].includes(envMode)) {
        aiConfig.setMode(envMode)
    }
}
