// Types pour le système multi-agent

export interface SwarmState {
    // Input
    userMessage: string
    history: Array<{ role: string; content: string }>
    contactId: string
    agentId: string
    conversationId?: number
    settings?: any
    userName?: string
    lastMessageType?: string

    // Analyse
    intention?: IntentionResult

    // Contextes
    contexts: {
        timing?: string
        memory?: string
        phase?: string
        persona?: string
        style?: string
        payment?: string
        media?: string
        voice?: string
    }

    // Assemblage
    assembledPrompt?: string

    // Output
    response?: string
    error?: string
    
    // Meta
    photoType?: string
    shouldSendVoice?: boolean
    currentPhase?: string
}

export interface IntentionResult {
    intention: 'paiement' | 'photo' | 'vocal' | 'personnel' | 'general' | 'multi'
    sousIntention?: 'demande' | 'offre' | 'question' | 'refus' | 'confirmation'
    urgence: 'high' | 'normal' | 'low'
    besoinTiming: boolean
    besoinMemoire: boolean
    besoinPhase: boolean
    besoinPayment: boolean
    besoinMedia: boolean
    besoinVoice: boolean
    confiance: number
}

export type NodeFunction = (state: SwarmState) => Promise<Partial<SwarmState>>

export type NodeResult = Partial<SwarmState>

export interface EdgeConfig {
    from: string
    to: string
    condition?: (state: SwarmState) => boolean
}

export interface AgentContext {
    agentId: string
    contactId: string
    phase?: string
    signals?: string[]
}
