/**
 * Supervisor AI - Types communs pour le système de supervision
 */

export type SupervisorAgentType = 'COHERENCE' | 'CONTEXT' | 'PHASE' | 'ACTION' | 'QUEUE';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertStatus = 'NEW' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';

export type AlertType =
    // Coherence Agent
    | 'REPETITION'
    | 'SYSTEM_LEAK'
    | 'HALLUCINATION'
    | 'PERSONA_BREAK'
    // Context Agent
    | 'CONTEXT_LOSS'
    | 'TOPIC_JUMP'
    | 'WRONG_RECIPIENT'
    // Phase Agent
    | 'SUSPICIOUS_JUMP'
    | 'MISSING_SIGNALS'
    | 'IMPOSSIBLE_TRANSITION'
    // Action Agent
    | 'UNREQUESTED_PHOTO'
    | 'UNREQUESTED_IMAGE_TAG'
    | 'VOICE_WITHOUT_TRIGGER'
    | 'PHOTO_WRONG_PHASE'
    // Queue Agent
    | 'STUCK_IN_QUEUE'
    | 'QUEUE_OVERDUE';

export interface SupervisorAlert {
    id?: string;
    agentId: string;
    conversationId: number;
    contactId?: string | null;
    agentType: SupervisorAgentType;
    alertType: AlertType;
    severity: AlertSeverity;
    title: string;
    description: string;
    evidence: Record<string, any>;
    status?: AlertStatus | null;
    autoPaused?: boolean | null;
    createdAt?: Date | null;
}

export interface AnalysisContext {
    agentId: string;
    conversationId: number;
    contactId?: string | null;
    userMessage: string;
    aiResponse: string;
    history: { role: 'user' | 'ai'; content: string }[];
    phase: string;
    previousAlerts?: SupervisorAlert[];
    pendingQueue?: { id: string; content: string; scheduledAt: string }[];
}

export interface AgentAnalysisResult {
    alerts: SupervisorAlert[];
    shouldPause: boolean;
    confidence: number;
}

export interface CoherenceEvidence {
    repeatedPhrases?: string[];
    repeatedCount?: number;
    leakedContent?: string;
    leakType?: 'SYSTEM' | 'PROMPT' | 'INSTRUCTION';
    hallucination?: string;
    personaBreak?: string;
    expectedPersona?: string;
    actualTone?: string;
}

export interface ContextEvidence {
    userAsked: string;
    aiAnswered: string;
    contextMismatch: string;
    relevantHistory: string[];
}

export interface PhaseEvidence {
    fromPhase: string;
    toPhase: string;
    timeElapsed: string;
    messageCount: number;
    hasPayment: boolean;
    signalsDetected: string[];
    expectedMinTime?: string;
}

export interface ActionEvidence {
    action: 'SENT_PHOTO' | 'USED_IMAGE_TAG' | 'SENT_VOICE';
    triggerMessage?: string;
    shouldHaveTriggered: boolean;
    aiResponse: string;
    detectedKeywords?: string[];
    currentPhase?: string;
}

export interface QueueEvidence {
    queueItemId: string;
    scheduledAt: string;
    currentTime: string;
    delayMinutes: number;
    contactPhone?: string;
    messagePreview?: string;
    status: string;
}
