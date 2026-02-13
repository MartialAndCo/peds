/**
 * Memory-Signal Bridge
 * 
 * Corrèle le système de mémoires Mem0 avec le système de signaux comportementaux.
 * Quand une mémoire est extraite, cette bridge détecte automatiquement les signaux implicites.
 * 
 * Ex: "User said they love me" → Signal ATTACHED
 * Ex: "User sent $50" → Signal FINANCIAL_TRUST
 */

import { prisma } from '@/lib/prisma'
import { TrustSignal, signalAnalyzerV2 } from './signal-analyzer-v2'

// Patterns de détection pour signaux implicites
const SIGNAL_PATTERNS: Record<TrustSignal, RegExp[]> = {
    'ATTACHED': [
        /love you/i,
        /miss you/i,
        /think about you/i,
        /je t'aime/i,
        /tu me manques/i,
        /je pense à toi/i,
        /you're special/i,
        /tu es spécial/i,
        /my favorite/i,
        /mon préféré/i
    ],
    'FINANCIAL_TRUST': [
        /sent \$?\d+/i,
        /paid \$?\d+/i,
        /transferr?ed \$?\d+/i,
        /envoyé \$?\d+/i,
        /payé \$?\d+/i,
        /virement de \$?\d+/i,
        /offered to (pay|help)/i,
        /proposé de (payer|aider)/i,
        /can send money/i,
        /peux t'envoyer/i
    ],
    'EMOTIONALLY_OPEN': [
        /shared (that|how)/i,
        /told me about/i,
        /divorce/i,
        /breakup/i,
        /sad about/i,
        /worried about/i,
        /stressed about/i,
        /family problems/i,
        /personal issue/i,
        /depressed/i,
        /anxious/i
    ],
    'PROACTIVE': [
        /initiated conversation/i,
        /started chat/i,
        /reached out/i,
        /premier à message/i,
        /a commencé la conversation/i,
        /contacted first/i
    ],
    'DEFENSIVE': [
        /asked if (i am|im) real/i,
        /questioned authenticity/i,
        /threatened to block/i,
        /menacé de bloquer/i,
        /suspicious/i,
        /méfiant/i,
        /who are you really/i,
        /qui es-tu vraiment/i,
        /scam/i,
        /arnaque/i
    ],
    'RESPONSIVE': [], // Détecté via métriques, pas mémoires
    'INTERESTED': [
        /asked about (my|me)/i,
        /wants to know/i,
        /curious about/i,
        /demandé sur/i,
        /veut savoir/i
    ],
    'COMPLIANT': [
        /sent (photo|picture|image)/i,
        /shared (photo|picture)/i,
        /envoyé une photo/i,
        /accepté de/i,
        /agreed to/i
    ]
}

export const memorySignalBridge = {
    /**
     * Analyse une mémoire extraite et détecte les signaux implicites
     */
    detectSignalsFromMemory(memoryText: string): Array<{ signal: TrustSignal; confidence: number; reason: string }> {
        const detected: Array<{ signal: TrustSignal; confidence: number; reason: string }> = []
        const text = memoryText.toLowerCase()
        
        for (const [signal, patterns] of Object.entries(SIGNAL_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(text)) {
                    // Calculer confiance basée sur la spécificité
                    const confidence = this.calculateConfidence(text, pattern)
                    detected.push({
                        signal: signal as TrustSignal,
                        confidence,
                        reason: `Detected in memory: "${memoryText.substring(0, 50)}..."`
                    })
                    break // Un seul match par signal suffit
                }
            }
        }
        
        return detected
    },

    /**
     * Calcule la confiance d'un pattern match
     */
    calculateConfidence(text: string, pattern: RegExp): number {
        // Patterns plus longs = plus spécifiques = plus confiants
        const patternLength = pattern.source.length
        if (patternLength > 30) return 0.9
        if (patternLength > 20) return 0.8
        if (patternLength > 10) return 0.7
        return 0.6
    },

    /**
     * 🔥 FONCTION PRINCIPALE: Process un batch de mémoires et met à jour les signaux
     */
    async processMemories(
        agentId: string,
        contactId: string,
        memories: string[]
    ): Promise<{
        newSignals: TrustSignal[]
        reasons: Record<string, string>
    }> {
        const newSignals: TrustSignal[] = []
        const reasons: Record<string, string> = {}

        for (const memory of memories) {
            const detected = this.detectSignalsFromMemory(memory)
            
            for (const { signal, confidence, reason } of detected) {
                // Ne pas dupliquer
                if (!newSignals.includes(signal) && confidence >= 0.7) {
                    newSignals.push(signal)
                    reasons[signal] = reason
                }
            }
        }

        // Logger les détections dans SignalLog (mais pas besoin de mettre à jour AgentContact,
        // car ça sera fait par le signal analyzer lors de sa prochaine exécution)
        for (const signal of newSignals) {
            const existingLog = await prisma.signalLog.findFirst({
                where: {
                    agentId,
                    contactId,
                    signal,
                    action: 'DETECTED',
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 derniers jours
                    }
                }
            })

            // Ne pas créer de doublon si déjà détecté récemment
            if (!existingLog) {
                await prisma.signalLog.create({
                    data: {
                        agentId,
                        contactId,
                        signal,
                        action: 'DETECTED',
                        reason: `Auto-detected from Mem0: ${reasons[signal]}`
                    }
                })
                console.log(`[MemorySignalBridge] Auto-detected ${signal} from memory for ${contactId}`)
            }
        }

        return { newSignals, reasons }
    },

    /**
     * 🔥 HOOK: À appeler après extraction de mémoires
     */
    async onMemoryExtraction(
        agentId: string,
        contactId: string,
        extractedFacts: string[]
    ): Promise<void> {
        if (extractedFacts.length === 0) return

        console.log(`[MemorySignalBridge] Processing ${extractedFacts.length} memories for signal detection...`)
        
        const result = await this.processMemories(agentId, contactId, extractedFacts)
        
        if (result.newSignals.length > 0) {
            console.log(`[MemorySignalBridge] Auto-detected signals: ${result.newSignals.join(', ')}`)
            
            // Déclencher une mise à jour immédiate des signaux si nouveaux signaux trouvés
            await signalAnalyzerV2.updateSignals(agentId, contactId)
        }
    }
}
