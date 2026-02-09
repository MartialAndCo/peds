// Types pour le système multi-agent

export interface SwarmSettings {
    venice_api_key: string
    venice_model: string
    timezone: string
    locale: string
    // Payment settings (pour éviter requêtes dans payment-node)
    payment_paypal_enabled?: boolean
    payment_paypal_username?: string
    payment_venmo_enabled?: boolean
    payment_venmo_username?: string
    payment_cashapp_enabled?: boolean
    payment_cashapp_username?: string
    payment_zelle_enabled?: boolean
    payment_zelle_username?: string
    payment_bank_enabled?: boolean
    payment_custom_methods?: string
}

export interface AgentProfile {
    contextTemplate?: string | null
    styleRules?: string | null
    identityTemplate?: string | null
    phaseConnectionTemplate?: string | null
    phaseVulnerabilityTemplate?: string | null
    phaseCrisisTemplate?: string | null
    phaseMoneypotTemplate?: string | null
    paymentRules?: string | null
    safetyRules?: string | null
    timezone?: string | null
    locale?: string | null
    baseAge?: number | null
    bankAccountNumber?: string | null
    bankRoutingNumber?: string | null
}

export interface AgentContactData {
    phase?: string | null
    signals?: string[] | null
    paymentEscalationTier?: number | null
}

export interface SwarmState {
    // Input
    userMessage: string
    history: Array<{ role: string; content: string }>
    contactId: string
    contactPhone?: string  // Pour les mémoires (différent de contactId)
    agentId: string
    conversationId?: number
    settings: SwarmSettings  // Typé strictement au lieu de 'any'
    userName?: string
    lastMessageType?: string
    platform?: 'whatsapp' | 'discord'  // Platform context

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
        safety?: string  // Règles de sécurité depuis DB
        lead?: string  // Smart Add context
    }
    
    // Smart Add lead context
    leadContext?: string

    // Assemblage
    assembledPrompt?: string

    // Output
    response?: string
    error?: string
    
    // Meta
    photoType?: string
    shouldSendVoice?: boolean
    currentPhase?: string
    isBlacklisted?: boolean  // Si la demande média est blacklistée
    
    // Profile complet de l'agent (pour accès rapide aux templates)
    profile?: AgentProfile
    
    // Données AgentContact (pour éviter requêtes)
    agentContact?: AgentContactData
    
    // Messages bruts pour analyse
    messages?: Array<{ role: string; content: string; timestamp?: Date }>
    
    // Métadonnées pour stockage temporaire entre nœuds
    metadata?: Record<string, any>
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
