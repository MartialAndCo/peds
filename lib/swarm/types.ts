export interface Message {
    role: string
    content: string
    timestamp?: Date
}

export interface NodeMetric {
    durationMs: number
    startedAt: number
    finishedAt: number
}

export interface SwarmMetadata {
    nodeMetrics?: Record<string, NodeMetric>
    executionOrder?: string[]
    [key: string]: unknown
}

export interface SwarmSettings {
    venice_api_key: string
    venice_model: string
    timezone: string
    locale: string
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
    voice_response_enabled?: boolean
    validation_llm_enabled?: boolean
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

export interface SwarmOptions {
    lastMessageType?: string
    platform?: 'whatsapp' | 'discord'
    preloadedProfile?: AgentProfile
    externalSystemContext?: string
    simulationMode?: boolean
}

export interface SwarmState {
    userMessage: string
    history: Message[]
    messages: Message[]
    contactId: string
    contactPhone?: string
    agentId: string
    conversationId?: number
    settings: SwarmSettings
    userName?: string
    lastMessageType?: string
    platform?: 'whatsapp' | 'discord'
    externalSystemContext?: string
    simulationMode?: boolean

    intention?: IntentionResult

    contexts: {
        timing?: string
        knownFacts?: string
        memory?: string
        phase?: string
        persona?: string
        style?: string
        payment?: string
        media?: string
        voice?: string
        safety?: string
        lead?: string
    }

    leadContext?: string
    assembledPrompt?: string

    response?: string
    error?: string

    photoType?: string
    shouldSendVoice?: boolean
    currentPhase?: string
    isBlacklisted?: boolean

    profile?: AgentProfile
    agentContact?: AgentContactData

    metadata: SwarmMetadata

    activeScenario?: {
        scenarioId: string
        title: string
        description: string
        targetContext?: string | null
    }
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
