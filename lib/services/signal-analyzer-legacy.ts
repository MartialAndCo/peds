/**
 * Signal Analyzer Service
 * 
 * Replaces the numeric trust score system with discrete behavioral signals.
 * Signals are binary indicators detected via AI analysis of conversation content.
 */

import { prisma } from '@/lib/prisma'
import { settingsService } from '@/lib/settings-cache'

// ============================================================================
// SIGNAL DEFINITIONS
// ============================================================================

export type TrustSignal =
    | 'RESPONSIVE'        // Responds quickly, frequent conversations
    | 'EMOTIONALLY_OPEN'  // Shares feelings, personal problems
    | 'PROACTIVE'         // Initiates conversations
    | 'COMPLIANT'         // Accepts requests (photos, etc.)
    | 'DEFENSIVE'         // Suspicious, asks identity questions (NEGATIVE - blocks progression)
    | 'INTERESTED'        // Asks questions, wants to know more
    | 'ATTACHED'          // Expresses affection, jealousy, longing
    | 'FINANCIAL_TRUST'   // Has paid or offered to pay

export const ALL_SIGNALS: TrustSignal[] = [
    'RESPONSIVE', 'EMOTIONALLY_OPEN', 'PROACTIVE', 'COMPLIANT',
    'DEFENSIVE', 'INTERESTED', 'ATTACHED', 'FINANCIAL_TRUST'
]

export const NEGATIVE_SIGNALS: TrustSignal[] = ['DEFENSIVE']

// ============================================================================
// PHASE TRANSITION RULES
// ============================================================================

export type AgentPhase = 'CONNECTION' | 'VULNERABILITY' | 'CRISIS' | 'MONEYPOT'

interface TransitionRule {
    requiredCount?: number       // Number of signals required from the pool
    requiredFrom?: TrustSignal[] // Pool of signals to count from
    requiredAll?: TrustSignal[]  // All these signals must be present
    blockers?: TrustSignal[]     // If any of these are present, block transition
    minDays?: number             // Minimum duration in current phase/relationship
}

export const PHASE_TRANSITIONS: Record<string, TransitionRule> = {
    'CONNECTION_TO_VULNERABILITY': {
        requiredCount: 2,
        requiredFrom: ['RESPONSIVE', 'INTERESTED', 'EMOTIONALLY_OPEN', 'PROACTIVE'],
        blockers: ['DEFENSIVE'],
        minDays: 2 // Prevent day-1 jumps
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
// SIGNAL ANALYZER SERVICE
// ============================================================================

export const signalAnalyzer = {
    /**
     * Analyze conversation and detect signals using AI
     */
    async analyzeConversation(agentId: string, contactId: string): Promise<{
        detected: TrustSignal[]
        lost: TrustSignal[]
        reasoning: Partial<Record<TrustSignal, string>>
    }> {
        const contact = await prisma.contact.findUnique({ where: { id: contactId } })
        if (!contact) throw new Error('Contact not found')

        const agentContact = await prisma.agentContact.findUnique({
            where: { agentId_contactId: { agentId, contactId } }
        })

        const currentSignals = (agentContact?.signals || []) as TrustSignal[]

        // Fetch recent conversation
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

        // Calculate objective metrics
        const userMessages = recentMessages.filter(m => m.sender === 'contact')
        const userInitiatedCount = this.countUserInitiatedConversations(recentMessages)

        const settings = await settingsService.getSettings()

        // AI Analysis Prompt
        const analysisPrompt = `You are analyzing a conversation to detect behavioral signals.

CURRENT SIGNALS ACTIVE: [${currentSignals.join(', ') || 'None'}]

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
A signal is LOST if it was previously active but the behavior is no longer present.

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
- Be conservative: when in doubt, don't detect the signal`

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
                    { apiKey: settings.venice_api_key, model: 'llama-3.3-70b' }
                )
            }

            const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim()
            const parsed = JSON.parse(cleanJson)

            // Validate signals
            result.detected = (parsed.detected || []).filter((s: string) => ALL_SIGNALS.includes(s as TrustSignal))
            result.lost = (parsed.lost || []).filter((s: string) => ALL_SIGNALS.includes(s as TrustSignal))
            result.reasoning = parsed.reasoning || {}

            console.log(`[SignalAnalyzer] Detected: [${result.detected.join(', ')}], Lost: [${result.lost.join(', ')}]`)
        } catch (e) {
            console.error('[SignalAnalyzer] AI analysis failed:', e)
        }

        return result
    },

    /**
     * Count how many times the user initiated a conversation segment
     */
    countUserInitiatedConversations(messages: any[]): number {
        let count = 0
        let lastSender = ''
        const sortedMsgs = [...messages].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )

        for (const msg of sortedMsgs) {
            // If there's a gap of > 4 hours and user started, count it
            if (msg.sender === 'contact' && lastSender !== 'contact') {
                count++
            }
            lastSender = msg.sender
        }
        return count
    },

    /**
     * Update signals for a contact and persist changes
     */
    async updateSignals(agentId: string, contactId: string): Promise<{
        newSignals: TrustSignal[]
        lostSignals: TrustSignal[]
        currentSignals: TrustSignal[]
        shouldAdvancePhase: boolean
        newPhase?: AgentPhase
    }> {
        const agentContact = await prisma.agentContact.findUnique({
            where: { agentId_contactId: { agentId, contactId } }
        })

        if (!agentContact) {
            console.warn(`[SignalAnalyzer] No AgentContact found for ${agentId}/${contactId}`)
            return { newSignals: [], lostSignals: [], currentSignals: [], shouldAdvancePhase: false }
        }

        const currentSignals = new Set<TrustSignal>((agentContact.signals || []) as TrustSignal[])
        const currentPhase = agentContact.phase as AgentPhase

        // Calculate daysActive
        const contact = await prisma.contact.findUnique({ where: { id: contactId } })
        const contactCreatedAt = contact?.createdAt || new Date()
        const daysActive = Math.max(0, (Date.now() - contactCreatedAt.getTime()) / (1000 * 60 * 60 * 24))

        // Run AI analysis
        const analysis = await this.analyzeConversation(agentId, contactId)

        // Apply changes
        const newSignals: TrustSignal[] = []
        const lostSignals: TrustSignal[] = []

        for (const signal of analysis.detected) {
            if (!currentSignals.has(signal)) {
                currentSignals.add(signal)
                newSignals.push(signal)

                // Log detection
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
            if (currentSignals.has(signal)) {
                currentSignals.delete(signal)
                lostSignals.push(signal)

                // Log loss
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

        const finalSignals = Array.from(currentSignals)

        // Check phase transition
        const transition = this.checkPhaseTransition(currentPhase, finalSignals, daysActive)

        // Persist
        await prisma.agentContact.update({
            where: { id: agentContact.id },
            data: {
                signals: finalSignals,
                lastSignalAnalysis: new Date(),
                ...(transition.canAdvance && transition.nextPhase ? {
                    phase: transition.nextPhase,
                    lastPhaseUpdate: new Date()
                } : {})
            }
        })

        if (transition.canAdvance && transition.nextPhase) {
            console.log(`[SignalAnalyzer] Phase transition: ${currentPhase} → ${transition.nextPhase}`)
        }

        return {
            newSignals,
            lostSignals,
            currentSignals: finalSignals,
            shouldAdvancePhase: transition.canAdvance,
            newPhase: transition.nextPhase
        }
    },

    /**
     * Check if phase transition is possible based on current signals and conditions
     */
    checkPhaseTransition(currentPhase: AgentPhase, signals: TrustSignal[], daysActive: number = 0): {
        canAdvance: boolean
        nextPhase?: AgentPhase
        missingSignals?: TrustSignal[]
        blockerSignals?: TrustSignal[]
        timeRemaining?: number
    } {
        const signalSet = new Set(signals)

        // Determine which transition to check
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
                // Already at max phase
                return { canAdvance: false }
            default:
                return { canAdvance: false }
        }

        const rule = PHASE_TRANSITIONS[transitionKey]
        if (!rule) return { canAdvance: false }

        // Check blockers
        const blockerSignals = (rule.blockers || []).filter(b => signalSet.has(b))
        if (blockerSignals.length > 0) {
            return { canAdvance: false, blockerSignals }
        }

        // Check required signals (all must be present)
        if (rule.requiredAll) {
            const missing = rule.requiredAll.filter(s => !signalSet.has(s))
            if (missing.length > 0) {
                return { canAdvance: false, missingSignals: missing }
            }
        }

        // Check required count from pool
        if (rule.requiredCount && rule.requiredFrom) {
            const matchCount = rule.requiredFrom.filter(s => signalSet.has(s)).length
            if (matchCount < rule.requiredCount) {
                const missing = rule.requiredFrom.filter(s => !signalSet.has(s))
                return { canAdvance: false, missingSignals: missing }
            }
        }

        // Check time constraint
        if (rule.minDays && daysActive < rule.minDays) {
            return { canAdvance: false, timeRemaining: rule.minDays - daysActive }
        }

        return { canAdvance: true, nextPhase }
    },

    /**
     * Get signal display info for UI
     */
    getSignalInfo(signal: TrustSignal): { emoji: string, label: string, isNegative: boolean } {
        const info: Record<TrustSignal, { emoji: string, label: string }> = {
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
            isNegative: NEGATIVE_SIGNALS.includes(signal)
        }
    }
}
