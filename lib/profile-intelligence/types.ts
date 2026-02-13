/**
 * Types pour le système de profil intelligent v2
 * Séparé de Mem0 - Système de renseignement opérateur
 */

export interface ExtractionContext {
    contactId: string
    agentId: string
    messages: MessageForExtraction[]
    existingProfile: ExistingProfile | null
}

export interface MessageForExtraction {
    id: number
    sender: 'contact' | 'ai' | 'admin'
    text: string
    timestamp: Date
}

export interface ExistingProfile {
    attributes: ExistingAttribute[]
    relationships: ExistingRelationship[]
    events: ExistingEvent[]
    interests: ExistingInterest[]
    psychology: ExistingPsychology | null
    financial: ExistingFinancial | null
}

export interface ExistingAttribute {
    key: string
    value: string
    category: string
    confidence: number
}

export interface ExistingRelationship {
    relationType: string
    name: string | null
}

export interface ExistingEvent {
    title: string
    eventType: string
}

export interface ExistingInterest {
    category: string
    name: string
}

export interface ExistingPsychology {
    emotionalState: string | null
    vulnerabilities: string[]
}

export interface ExistingFinancial {
    situation: string | null
    urgentNeeds: string[]
}

// Résultats d'extraction

export interface IdentityExtraction {
    displayName?: string
    realName?: string
    aliases: string[]
    age?: number
    ageConfirmed: boolean
    gender?: string
    birthDate?: string // ISO date
    city?: string
    country?: string
    timezone?: string
    maritalStatus?: string
    livingWith?: string
    occupation?: string
    workplace?: string
    incomeLevel?: 'low' | 'medium' | 'high'
    schedule?: string
    platforms: string[]
    usernames: Record<string, string>
}

export interface SocialExtraction {
    relationships: {
        relationType: string
        name?: string
        details?: string
        closeness?: 'close' | 'distant' | 'conflictual' | 'unknown'
    }[]
}

export interface ContextExtraction {
    events: {
        eventType: 'past' | 'upcoming' | 'recurring'
        title: string
        date?: string // ISO date
        dateVague?: string
        importance: 'minor' | 'normal' | 'major' | 'critical'
    }[]
}

export interface InterestExtraction {
    interests: {
        category: string
        name: string
        level?: 'casual' | 'enthusiast' | 'passionate' | 'professional'
        details?: string
    }[]
}

export interface PsychologyExtraction {
    traits: {
        openness?: number // 1-10
        conscientiousness?: number
        extraversion?: number
        agreeableness?: number
        neuroticism?: number
    }
    communication: {
        style?: 'direct' | 'passive' | 'aggressive' | 'manipulative' | 'passive_aggressive'
        responseSpeed?: 'fast' | 'normal' | 'slow' | 'erratic'
        verbosity?: 'concise' | 'normal' | 'verbose'
    }
    emotionalState?: string
    stressors: string[]
    redFlags: string[]
    greenFlags: string[]
    vulnerabilities: string[] // Pour escalation
}

export interface FinancialExtraction {
    situation?: 'stable' | 'precarious' | 'wealthy' | 'struggling' | 'unknown'
    occupationType?: 'employed' | 'student' | 'unemployed' | 'retired' | 'self_employed'
    hasDebts?: boolean
    debtAmount?: string
    urgentNeeds: string[]
    paymentCapacity?: 'none' | 'low' | 'medium' | 'high'
    paymentMethods: {
        paypal?: boolean
        cashapp?: boolean
        venmo?: boolean
        bankTransfer?: boolean
    }
}

export interface ExtractedAttribute {
    category: string
    key: string
    value: string
    valueType: 'string' | 'number' | 'boolean' | 'date' | 'json'
    source: 'message' | 'deduction' | 'inference'
    confidence: number
    context: string // Phrase source
    messageId?: number
    expiresAt?: Date
}

export interface FullExtractionResult {
    identity: IdentityExtraction
    social: SocialExtraction
    context: ContextExtraction
    interests: InterestExtraction
    psychology: PsychologyExtraction
    financial: FinancialExtraction
    attributes: ExtractedAttribute[]
    processingTimeMs: number
}

export interface ExtractionLog {
    triggeredBy: 'auto' | 'manual' | 'ai'
    messageRange: string
    attributesFound: number
    relationshipsFound: number
    eventsFound: number
    newInfoCount: number
    updatedInfoCount: number
    rejectedCount: number
    processingTimeMs: number
    aiTokensUsed?: number
    errors?: string
}
