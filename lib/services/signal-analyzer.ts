/**
 * Signal Analyzer Service V2
 * 
 * Améliorations pour conversations longues:
 * - TTL (Time-To-Live) sur les signaux avec expiration automatique
 * - Système de "confidence score" pondéré par la récence
 * - Régression de phase possible
 * - Détection proactive des changements comportementaux
 */

import { prisma } from '@/lib/prisma'
import { settingsService } from '@/lib/settings-cache'

// ============================================================================
// SIGNAL DEFINITIONS & CONFIGURATION
// ============================================================================

export type TrustSignal =
    | 'RESPONSIVE'        // Répond rapidement
    | 'EMOTIONALLY_OPEN'  // Partage sentiments
    | 'PROACTIVE'         // Initie conversations
    | 'COMPLIANT'         // Accepte demandes
    | 'DEFENSIVE'         // Suspect (négatif)
    | 'INTERESTED'        // Pose questions
    | 'ATTACHED'          // Affection/jalousie
    | 'FINANCIAL_TRUST'   // A payé ou offert

export const ALL_SIGNALS: TrustSignal[] = [
    'RESPONSIVE', 'EMOTIONALLY_OPEN', 'PROACTIVE', 'COMPLIANT',
    'DEFENSIVE', 'INTERESTED', 'ATTACHED', 'FINANCIAL_TRUST'
]

export const NEGATIVE_SIGNALS: TrustSignal[] = ['DEFENSIVE']

// 🔥 NOUVEAU: TTL (Time-To-Live) en millisecondes pour chaque signal
export const SIGNAL_TTL: Record<TrustSignal, number> = {
    'RESPONSIVE': 7 * 24 * 60 * 60 * 1000,      // 7 jours
    'EMOTIONALLY_OPEN': 14 * 24 * 60 * 60 * 1000, // 14 jours
    'PROACTIVE': 10 * 24 * 60 * 60 * 1000,       // 10 jours
    'COMPLIANT': 5 * 24 * 60 * 60 * 1000,        // 5 jours
    'DEFENSIVE': 3 * 24 * 60 * 60 * 1000,        // 3 jours (court - peut s'effacer vite)
    'INTERESTED': 7 * 24 * 60 * 60 * 1000,       // 7 jours
    'ATTACHED': 10 * 24 * 60 * 60 * 1000,        // 10 jours
    'FINANCIAL_TRUST': 30 * 24 * 60 * 60 * 1000  // 30 jours (long - la confiance financière persiste)
}

// 🔥 NOUVEAU: Seuils de régression de phase
export const REGRESSION_RULES = {
    // Si un contact en VULNERABILITY devient DEFENSIF + silencieux → retour CONNECTION
    VULNERABILITY_TO_CONNECTION: {
        conditions: ['DEFENSIVE'],
        minInactiveHours: 72,  // 3 jours sans message
        requiredExpiredSignals: ['EMOTIONALLY_OPEN', 'ATTACHED']  // Ces signaux doivent être expirés
    },
    // Si un contact en CRISIS perd son ATTACHEMENT → retour VULNERABILITY
    CRISIS_TO_VULNERABILITY: {
        conditions: [],
        minInactiveHours: 48,
        requiredExpiredSignals: ['ATTACHED']
    },
    // Si un contact en MONEYPOT devient DEFENSIF → retour CRISIS (urgent!)
    MONEYPOT_TO_CRISIS: {
        conditions: ['DEFENSIVE'],
        minInactiveHours: 24,
        requiredExpiredSignals: ['FINANCIAL_TRUST']
    }
}

export type AgentPhase = 'CONNECTION' | 'VULNERABILITY' | 'CRISIS' | 'MONEYPOT'

interface TransitionRule {
    requiredCount?: number
    requiredFrom?: TrustSignal[]
    requiredAll?: TrustSignal[]
    blockers?: TrustSignal[]
    minDays?: number
}

export const PHASE_TRANSITIONS: Record<string, TransitionRule> = {
    'CONNECTION_TO_VULNERABILITY': {
        requiredCount: 2,
        requiredFrom: ['RESPONSIVE', 'INTERESTED', 'EMOTIONALLY_OPEN', 'PROACTIVE'],
        blockers: ['DEFENSIVE'],
        minDays: 2
    },
    'VULNERABILITY_TO_CRISIS': {
        requiredAll: ['ATTACHED', 'EMOTIONALLY_OPEN'],
        blockers: ['DEFENSIVE']
    },
    'CRISIS_TO_MONEYPOT': {
        requiredAll: ['FINANCIAL_TRUST']
    }
}

// ============================================================================
// TYPES POUR SIGNAUX PONDÉRÉS
// ============================================================================

export interface WeightedSignal {
    signal: TrustSignal
    detectedAt: Date
    expiresAt: Date
    confidence: number  // 0-1, calculé basé sur la récence
    occurrences: number  // Combien de fois détecté
    lastConfirmed: Date
}

export interface SignalAnalysisResult {
    signals: WeightedSignal[]
    activeSignals: TrustSignal[]  // Signaux non expirés uniquement
    expiredSignals: TrustSignal[] // Signaux récemment expirés
    canAdvance: boolean
    shouldRegress: boolean
    nextPhase?: AgentPhase
    previousPhase?: AgentPhase
    reason: string
}

// ============================================================================
// SIGNAL ANALYZER SERVICE V2
// ============================================================================

export const signalAnalyzerV2 = {
    /**
     * 🔥 NOUVEAU: Récupère les signaux avec leurs métadonnées complètes
     */
    async getWeightedSignals(agentId: string, contactId: string): Promise<WeightedSignal[]> {
        const signalLogs = await prisma.signalLog.findMany({
            where: { agentId, contactId },
            orderBy: { createdAt: 'desc' }
        })

        const signalMap = new Map<TrustSignal, WeightedSignal>()

        for (const log of signalLogs) {
            const signal = log.signal as TrustSignal
            
            if (log.action === 'DETECTED') {
                if (!signalMap.has(signal)) {
                    const detectedAt = log.createdAt
                    const ttl = SIGNAL_TTL[signal]
                    const expiresAt = new Date(detectedAt.getTime() + ttl)
                    
                    signalMap.set(signal, {
                        signal,
                        detectedAt,
                        expiresAt,
                        confidence: this.calculateConfidence(detectedAt, ttl),
                        occurrences: 1,
                        lastConfirmed: detectedAt
                    })
                } else {
                    // Signal déjà détecté, incrémenter occurrences
                    const existing = signalMap.get(signal)!
                    existing.occurrences++
                    existing.lastConfirmed = log.createdAt
                    // Recalculer confiance avec la date la plus récente
                    existing.confidence = this.calculateConfidence(log.createdAt, SIGNAL_TTL[signal])
                }
            } else if (log.action === 'LOST' && signalMap.has(signal)) {
        // Signal perdu, le marquer comme expiré
                const existing = signalMap.get(signal)!
                existing.expiresAt = log.createdAt  // Expiré à la date de perte
                existing.confidence = 0
            }
        }

        return Array.from(signalMap.values())
    },

    /**
     * 🔥 NOUVEAU: Calcule la confiance d'un signal basée sur sa récence
     */
    calculateConfidence(detectedAt: Date, ttl: number): number {
        const now = Date.now()
        const detected = detectedAt.getTime()
        const age = now - detected
        
        if (age >= ttl) return 0
        
        // Confiance linéaire: 1.0 quand frais, 0.0 quand expiré
        // Mais avec une courbe plus douce au début
        const ratio = age / ttl
        return Math.max(0, 1 - Math.pow(ratio, 2))  // Courbe quadratique décroissante
    },

    /**
     * 🔥 NOUVEAU: Vérifie si un signal est expiré
     */
    isExpired(signal: WeightedSignal): boolean {
        return Date.now() > signal.expiresAt.getTime()
    },

    /**
     * 🔥 NOUVEAU: Analyse complète avec gestion de la régression
     */
    async analyzeWithTTL(agentId: string, contactId: string): Promise<SignalAnalysisResult> {
        const weightedSignals = await this.getWeightedSignals(agentId, contactId)
        const now = Date.now()
        
        // Séparer actifs et expirés
        const activeSignals = weightedSignals.filter(s => !this.isExpired(s))
        const expiredSignals = weightedSignals.filter(s => this.isExpired(s))
        
        const activeSignalNames = activeSignals.map(s => s.signal)
        const expiredSignalNames = expiredSignals.map(s => s.signal)
        
        // Récupérer la phase actuelle
        const agentContact = await prisma.agentContact.findUnique({
            where: { agentId_contactId: { agentId, contactId } }
        })
        
        if (!agentContact) {
            return {
                signals: weightedSignals,
                activeSignals: activeSignalNames,
                expiredSignals: expiredSignalNames,
                canAdvance: false,
                shouldRegress: false,
                reason: 'No AgentContact found'
            }
        }
        
        const currentPhase = agentContact.phase as AgentPhase
        
        // Récupérer le contact pour la date de création
        const contactRecord = await prisma.contact.findUnique({
            where: { id: contactId },
            select: { createdAt: true }
        })
        
        // Vérifier progression
        const advanceCheck = this.checkPhaseTransition(
            currentPhase, 
            activeSignalNames, 
            this.calculateDaysActive(contactRecord?.createdAt || new Date())
        )
        
        // 🔥 NOUVEAU: Vérifier régression
        const regressionCheck = await this.checkPhaseRegression(
            currentPhase,
            activeSignalNames,
            expiredSignalNames,
            agentId,
            contactId
        )
        
        // Déterminer la prochaine action
        let canAdvance = advanceCheck.canAdvance
        let shouldRegress = regressionCheck.shouldRegress
        let nextPhase = advanceCheck.nextPhase
        let previousPhase = regressionCheck.previousPhase
        let reason = advanceCheck.canAdvance 
            ? `Ready to advance: ${advanceCheck.nextPhase}` 
            : advanceCheck.reason || 'Cannot advance'
        
        if (regressionCheck.shouldRegress) {
            reason = `Regression needed: ${regressionCheck.reason}`
        }
        
        return {
            signals: weightedSignals,
            activeSignals: activeSignalNames,
            expiredSignals: expiredSignalNames,
            canAdvance,
            shouldRegress,
            nextPhase,
            previousPhase,
            reason
        }
    },

    /**
     * 🔥 NOUVEAU: Vérifie si la phase doit régresser
     */
    async checkPhaseRegression(
        currentPhase: AgentPhase,
        activeSignals: TrustSignal[],
        expiredSignals: TrustSignal[],
        agentId: string,
        contactId: string
    ): Promise<{ shouldRegress: boolean; previousPhase?: AgentPhase; reason?: string }> {
        
        // Récupérer dernier message pour inactivité
        const lastMessage = await prisma.message.findFirst({
            where: {
                conversation: {
                    agentId,
                    contactId
                }
            },
            orderBy: { timestamp: 'desc' }
        })
        
        if (!lastMessage) return { shouldRegress: false }
        
        const hoursSinceLastMessage = (Date.now() - new Date(lastMessage.timestamp).getTime()) / (1000 * 60 * 60)
        
        const activeSet = new Set<string>(activeSignals)
        const expiredSet = new Set<string>(expiredSignals)
        
        // Vérifier chaque règle de régression
        if (currentPhase === 'VULNERABILITY') {
            const rule = REGRESSION_RULES.VULNERABILITY_TO_CONNECTION
            const hasBlocker = rule.conditions.some(c => activeSet.has(c))
            const requiredExpired = rule.requiredExpiredSignals.every(s => expiredSet.has(s))
            
            if (hasBlocker && hoursSinceLastMessage >= rule.minInactiveHours / 24 && requiredExpired) {
                return {
                    shouldRegress: true,
                    previousPhase: 'CONNECTION',
                    reason: `DEFENSIVE active + ${Math.round(hoursSinceLastMessage)}h inactive + core signals expired`
                }
            }
        }
        
        if (currentPhase === 'CRISIS') {
            const rule = REGRESSION_RULES.CRISIS_TO_VULNERABILITY
            const requiredExpired = rule.requiredExpiredSignals.every(s => expiredSet.has(s))
            
            if (hoursSinceLastMessage >= rule.minInactiveHours && requiredExpired) {
                return {
                    shouldRegress: true,
                    previousPhase: 'VULNERABILITY',
                    reason: `ATTACHED expired + ${Math.round(hoursSinceLastMessage)}h inactive`
                }
            }
        }
        
        if (currentPhase === 'MONEYPOT') {
            const rule = REGRESSION_RULES.MONEYPOT_TO_CRISIS
            const hasBlocker = rule.conditions.some(c => activeSet.has(c))
            const requiredExpired = rule.requiredExpiredSignals.every(s => expiredSet.has(s))
            
            if ((hasBlocker || requiredExpired) && hoursSinceLastMessage >= rule.minInactiveHours) {
                return {
                    shouldRegress: true,
                    previousPhase: 'CRISIS',
                    reason: `FINANCIAL_TRUST lost + ${Math.round(hoursSinceLastMessage)}h inactive`
                }
            }
        }
        
        return { shouldRegress: false }
    },

    /**
     * 🔥 NOUVEAU: Met à jour les signaux avec TTL et gère la régression
     */
    async updateSignals(agentId: string, contactId: string): Promise<{
        newSignals: TrustSignal[]
        lostSignals: TrustSignal[]
        expiredSignals: TrustSignal[]
        currentSignals: TrustSignal[]
        shouldAdvancePhase: boolean
        shouldRegressPhase: boolean
        newPhase?: AgentPhase
        previousPhase?: AgentPhase
        weightedSignals: WeightedSignal[]
    }> {
        const agentContact = await prisma.agentContact.findUnique({
            where: { agentId_contactId: { agentId, contactId } }
        })

        if (!agentContact) {
            console.warn(`[SignalAnalyzerV2] No AgentContact found for ${agentId}/${contactId}`)
            return {
                newSignals: [],
                lostSignals: [],
                expiredSignals: [],
                currentSignals: [],
                shouldAdvancePhase: false,
                shouldRegressPhase: false,
                weightedSignals: []
            }
        }

        const currentPhase = agentContact.phase as AgentPhase

        // 1. Analyse AI pour nouveaux signaux
        const analysis = await this.analyzeConversation(agentId, contactId)
        
        // 2. Récupérer signaux existants avec poids
        const existingSignals = await this.getWeightedSignals(agentId, contactId)
        const existingSignalNames = new Set(existingSignals.map(s => s.signal))
        
        // 3. Détecter nouveaux et perdus
        const newSignals: TrustSignal[] = []
        const lostSignals: TrustSignal[] = []
        
        for (const signal of analysis.detected) {
            if (!existingSignalNames.has(signal)) {
                newSignals.push(signal)
                await prisma.signalLog.create({
                    data: {
                        agentId,
                        contactId,
                        signal,
                        action: 'DETECTED',
                        reason: analysis.reasoning[signal] || null
                    }
                })
            }
        }
        
        for (const signal of analysis.lost) {
            if (existingSignalNames.has(signal)) {
                lostSignals.push(signal)
                await prisma.signalLog.create({
                    data: {
                        agentId,
                        contactId,
                        signal,
                        action: 'LOST',
                        reason: analysis.reasoning[signal] || null
                    }
                })
            }
        }
        
        // 4. Recalculer tous les signaux avec TTL
        const updatedSignals = await this.getWeightedSignals(agentId, contactId)
        const activeSignals = updatedSignals.filter(s => !this.isExpired(s))
        const expiredSignals = updatedSignals.filter(s => this.isExpired(s))
        
        const finalSignalNames = activeSignals.map(s => s.signal)
        
        // 5. Analyse complète avec TTL
        const fullAnalysis = await this.analyzeWithTTL(agentId, contactId)
        
        // 6. Appliquer changements
        let newPhase = currentPhase
        let previousPhase: AgentPhase | undefined
        
        if (fullAnalysis.shouldRegress && fullAnalysis.previousPhase) {
            // 🔥 RÉGRESSION
            previousPhase = currentPhase
            newPhase = fullAnalysis.previousPhase
            console.log(`[SignalAnalyzerV2] ⬇️ PHASE REGRESSION: ${currentPhase} → ${newPhase}`)
        } else if (fullAnalysis.canAdvance && fullAnalysis.nextPhase) {
            // PROGRESSION
            newPhase = fullAnalysis.nextPhase
            console.log(`[SignalAnalyzerV2] ⬆️ PHASE ADVANCE: ${currentPhase} → ${newPhase}`)
        }
        
        // 7. Persister
        await prisma.agentContact.update({
            where: { id: agentContact.id },
            data: {
                signals: finalSignalNames,
                lastSignalAnalysis: new Date(),
                ...(newPhase !== currentPhase ? {
                    phase: newPhase,
                    lastPhaseUpdate: new Date()
                } : {})
            }
        })
        
        return {
            newSignals,
            lostSignals,
            expiredSignals: expiredSignals.map(s => s.signal),
            currentSignals: finalSignalNames,
            shouldAdvancePhase: fullAnalysis.canAdvance,
            shouldRegressPhase: fullAnalysis.shouldRegress,
            newPhase: newPhase !== currentPhase ? newPhase : undefined,
            previousPhase: fullAnalysis.shouldRegress ? currentPhase : undefined,
            weightedSignals: updatedSignals
        }
    },

    /**
     * Analyse conversation avec AI (similaire à V1)
     */
    async analyzeConversation(agentId: string, contactId: string): Promise<{
        detected: TrustSignal[]
        lost: TrustSignal[]
        reasoning: Partial<Record<TrustSignal, string>>
    }> {
        // [Code similaire à la V1 - réutilisation]
        const contact = await prisma.contact.findUnique({ where: { id: contactId } })
        if (!contact) throw new Error('Contact not found')

        const agentContact = await prisma.agentContact.findUnique({
            where: { agentId_contactId: { agentId, contactId } }
        })

        const currentSignals = (agentContact?.signals || []) as TrustSignal[]

        const conversation = await prisma.conversation.findFirst({
            where: { contactId, agentId },
            orderBy: { updatedAt: 'desc' }
        })

        if (!conversation) {
            return { detected: [], lost: [], reasoning: {} }
        }

        const recentMessages = await prisma.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { timestamp: 'desc' },
            take: 30
        })

        if (recentMessages.length < 3) {
            return { detected: [], lost: [], reasoning: {} }
        }

        const transcript = recentMessages.reverse()
            .map(m => `${m.sender.toUpperCase()}: ${m.message_text}`)
            .join('\n')

        const userMessages = recentMessages.filter(m => m.sender === 'contact')
        const userInitiatedCount = this.countUserInitiatedConversations(recentMessages)

        const settings = await settingsService.getSettings()

        // 🔥 PROMPT AMÉLIORÉ avec contexte TTL
        const analysisPrompt = `You are analyzing a conversation to detect behavioral signals.

CURRENT SIGNALS ACTIVE: [${currentSignals.join(', ') || 'None'}]
SIGNAL TTL INFO:
- RESPONSIVE, INTERESTED: 7 days
- EMOTIONALLY_OPEN: 14 days  
- PROACTIVE, ATTACHED: 10 days
- COMPLIANT: 5 days
- DEFENSIVE: 3 days (short - can fade quickly)
- FINANCIAL_TRUST: 30 days (long-lasting)

SIGNAL DEFINITIONS:
- RESPONSIVE: User replies within reasonable time, maintains conversation momentum
- EMOTIONALLY_OPEN: User shares personal feelings, problems, vulnerabilities, or secrets
- PROACTIVE: User initiates conversations or brings up new topics (User started ${userInitiatedCount} conversations)
- COMPLIANT: User agrees to requests, sends photos when asked, follows suggestions
- DEFENSIVE: User is suspicious, questions authenticity, threatens to block, asks for proof (NEGATIVE)
- INTERESTED: User asks personal questions, wants to learn more about the other person
- ATTACHED: User expresses affection, jealousy, possessiveness, or strong emotional connection
- FINANCIAL_TRUST: User has sent money, offered to pay, or discussed financial help positively

TRANSCRIPT (Last 30 messages):
${transcript}

TASK:
Analyze the transcript and determine which signals are NOW ACTIVE based on the conversation.
A signal is DETECTED if there's clear evidence in the transcript.
A signal is LOST if it was previously active but the behavior is no longer present for multiple exchanges.

Return ONLY valid JSON (no markdown):
{
  "detected": ["SIGNAL1", "SIGNAL2"],
  "lost": ["SIGNAL3"],
  "reasoning": {
    "SIGNAL1": "Brief explanation",
    "SIGNAL2": "Brief explanation"
  }
}

RULES:
- Only include signals with clear evidence
- DEFENSIVE blocks progression - detect it carefully
- FINANCIAL_TRUST requires actual payment or genuine offer, not just mentions of money
- Be conservative: when in doubt, don't detect the signal
- If a signal was active but user behavior changed significantly, mark it as LOST`

        let result = { detected: [] as TrustSignal[], lost: [] as TrustSignal[], reasoning: {} as Partial<Record<TrustSignal, string>> }

        try {
            const provider = settings.ai_provider || 'venice'
            let jsonStr = ""

            if (provider === 'anthropic') {
                const { anthropic } = require('@/lib/anthropic')
                jsonStr = await anthropic.chatCompletion(
                    "Analyze and output JSON only.",
                    [],
                    analysisPrompt,
                    { apiKey: settings.anthropic_api_key, model: 'claude-3-haiku-20240307' }
                )
            } else {
                const { venice } = require('@/lib/venice')
                jsonStr = await venice.chatCompletion(
                    "Analyze and output JSON only.",
                    [],
                    analysisPrompt,
                    { apiKey: settings.venice_api_key, model: 'google-gemma-3-27b-it' }
                )
            }

            const cleanJson = jsonStr.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim()
            const parsed = JSON.parse(cleanJson)

            result.detected = (parsed.detected || []).filter((s: string) => ALL_SIGNALS.includes(s as TrustSignal))
            result.lost = (parsed.lost || []).filter((s: string) => ALL_SIGNALS.includes(s as TrustSignal))
            result.reasoning = parsed.reasoning || {}

            console.log(`[SignalAnalyzerV2] Detected: [${result.detected.join(', ')}], Lost: [${result.lost.join(', ')}]`)
        } catch (e) {
            console.error('[SignalAnalyzerV2] AI analysis failed:', e)
        }

        return result
    },

    countUserInitiatedConversations(messages: any[]): number {
        let count = 0
        let lastSender = ''
        const sortedMsgs = [...messages].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )

        for (const msg of sortedMsgs) {
            if (msg.sender === 'contact' && lastSender !== 'contact') {
                count++
            }
            lastSender = msg.sender
        }
        return count
    },

    checkPhaseTransition(currentPhase: AgentPhase, signals: TrustSignal[], daysActive: number = 0): {
        canAdvance: boolean
        nextPhase?: AgentPhase
        missingSignals?: TrustSignal[]
        blockerSignals?: TrustSignal[]
        timeRemaining?: number
        reason?: string
    } {
        const signalSet = new Set(signals)

        let transitionKey: string
        let nextPhase: AgentPhase

        switch (currentPhase) {
            case 'CONNECTION':
                transitionKey = 'CONNECTION_TO_VULNERABILITY'
                nextPhase = 'VULNERABILITY'
                break
            case 'VULNERABILITY':
                transitionKey = 'VULNERABILITY_TO_CRISIS'
                nextPhase = 'CRISIS'
                break
            case 'CRISIS':
                transitionKey = 'CRISIS_TO_MONEYPOT'
                nextPhase = 'MONEYPOT'
                break
            case 'MONEYPOT':
                return { canAdvance: false, reason: 'Already at max phase' }
            default:
                return { canAdvance: false, reason: 'Unknown phase' }
        }

        const rule = PHASE_TRANSITIONS[transitionKey]
        if (!rule) return { canAdvance: false }

        // Check blockers
        const blockerSignals = (rule.blockers || []).filter(b => signalSet.has(b))
        if (blockerSignals.length > 0) {
            return { 
                canAdvance: false, 
                blockerSignals,
                reason: `Blocked by: ${blockerSignals.join(', ')}`
            }
        }

        // Check required signals (all must be present)
        if (rule.requiredAll) {
            const missing = rule.requiredAll.filter(s => !signalSet.has(s))
            if (missing.length > 0) {
                return { 
                    canAdvance: false, 
                    missingSignals: missing,
                    reason: `Missing required: ${missing.join(', ')}`
                }
            }
        }

        // Check required count from pool
        if (rule.requiredCount && rule.requiredFrom) {
            const matchCount = rule.requiredFrom.filter(s => signalSet.has(s)).length
            if (matchCount < rule.requiredCount) {
                const missing = rule.requiredFrom.filter(s => !signalSet.has(s))
                return { 
                    canAdvance: false, 
                    missingSignals: missing,
                    reason: `Need ${rule.requiredCount} signals, have ${matchCount}`
                }
            }
        }

        // Check time constraint
        if (rule.minDays && daysActive < rule.minDays) {
            return { 
                canAdvance: false, 
                timeRemaining: rule.minDays - daysActive,
                reason: `Need ${rule.minDays} days, have ${Math.floor(daysActive)}`
            }
        }

        return { canAdvance: true, nextPhase, reason: 'All conditions met' }
    },

    calculateDaysActive(createdAt: Date): number {
        return Math.max(0, (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    },

    getSignalInfo(signal: TrustSignal): { emoji: string; label: string; isNegative: boolean; ttl: number } {
        const info: Record<TrustSignal, { emoji: string; label: string }> = {
            RESPONSIVE: { emoji: '🔵', label: 'Responsive' },
            EMOTIONALLY_OPEN: { emoji: '💛', label: 'Emotionally Open' },
            PROACTIVE: { emoji: '🟣', label: 'Proactive' },
            COMPLIANT: { emoji: '✅', label: 'Compliant' },
            DEFENSIVE: { emoji: '🔴', label: 'Defensive' },
            INTERESTED: { emoji: '🟢', label: 'Interested' },
            ATTACHED: { emoji: '🩷', label: 'Attached' },
            FINANCIAL_TRUST: { emoji: '💰', label: 'Financial Trust' }
        }

        return {
            ...info[signal],
            isNegative: NEGATIVE_SIGNALS.includes(signal),
            ttl: SIGNAL_TTL[signal]
        }
    }
}

// Export retro-compatible
export const signalAnalyzer = signalAnalyzerV2
