/**
 * Phase Agent
 * Détecte les problèmes de transition de phase:
 * - Changements de phase trop rapides
 * - Speedrunning (mais avec discernement pour les paiements)
 * - Transitions impossibles
 */

import { prisma } from '@/lib/prisma';
import type {
    AnalysisContext,
    AgentAnalysisResult,
    SupervisorAlert,
    PhaseEvidence
} from './types';

// Durées minimales raisonnables par transition (en minutes)
const MIN_TRANSITION_TIME = {
    'CONNECTION_TO_VULNERABILITY': 30,      // 30 min minimum
    'VULNERABILITY_TO_CRISIS': 60,          // 1h minimum
    'CRISIS_TO_MONEYPOT': 30,               // 30 min minimum
    'CONNECTION_TO_MONEYPOT': 120,          // 2h minimum (saut direct suspect)
};

// Durées minimales si paiement reçu (beaucoup plus permissif)
const MIN_TRANSITION_TIME_WITH_PAYMENT = {
    'CONNECTION_TO_VULNERABILITY': 5,       // 5 min si déjà payé
    'VULNERABILITY_TO_CRISIS': 5,
    'CRISIS_TO_MONEYPOT': 0,                // Immédiat si paiement
    'CONNECTION_TO_MONEYPOT': 0,            // Immédiat si paiement (whale)
};

export const phaseAgent = {
    name: 'PHASE' as const,

    async analyze(context: AnalysisContext): Promise<AgentAnalysisResult> {
        const alerts: SupervisorAlert[] = [];

        const { agentId, conversationId, contactId, phase } = context;

        if (!contactId) {
            return { alerts, shouldPause: false, confidence: 0 };
        }

        // Récupérer les données de la conversation
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                contact: true,
                agent: true
            }
        });

        if (!conversation) {
            return { alerts, shouldPause: false, confidence: 0 };
        }

        // Récupérer l'agentContact pour voir l'historique des phases
        const agentContact = await prisma.agentContact.findUnique({
            where: {
                agentId_contactId: {
                    agentId,
                    contactId
                }
            }
        });

        if (!agentContact) {
            return { alerts, shouldPause: false, confidence: 0 };
        }

        // Vérifier si un paiement a été reçu récemment
        const recentPayment = await prisma.payment.findFirst({
            where: {
                contactId,
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24h
                },
                status: 'COMPLETED'
            },
            orderBy: { createdAt: 'desc' }
        });

        const hasRecentPayment = !!recentPayment;

        // Calculer le temps depuis le début de la conversation
        const conversationStart = conversation.createdAt;
        const timeElapsed = Date.now() - conversationStart.getTime();
        const timeElapsedMinutes = Math.floor(timeElapsed / (1000 * 60));

        // Compter les messages
        const messageCount = await prisma.message.count({
            where: { conversationId }
        });

        // Vérifier les transitions suspectes
        const currentPhase = agentContact.phase as string;
        const previousPhase = this.getPreviousPhase(currentPhase);

        if (previousPhase) {
            const transitionKey = `${previousPhase}_TO_${currentPhase}` as keyof typeof MIN_TRANSITION_TIME;
            const minTimeRequired = hasRecentPayment
                ? (MIN_TRANSITION_TIME_WITH_PAYMENT[transitionKey] ?? 60)
                : (MIN_TRANSITION_TIME[transitionKey] ?? 120);

            // Si la transition est trop rapide SANS paiement
            if (timeElapsedMinutes < minTimeRequired && !hasRecentPayment) {
                const evidence: PhaseEvidence = {
                    fromPhase: previousPhase,
                    toPhase: currentPhase,
                    timeElapsed: `${timeElapsedMinutes} minutes`,
                    messageCount,
                    hasPayment: false,
                    signalsDetected: agentContact.signals || [],
                    expectedMinTime: `${minTimeRequired} minutes`
                };

                alerts.push({
                    agentId,
                    conversationId,
                    contactId,
                    agentType: 'PHASE',
                    alertType: 'SUSPICIOUS_JUMP',
                    severity: 'MEDIUM', // Pas CRITICAL car c'est comportemental
                    title: `Transition rapide ${previousPhase} → ${currentPhase}`,
                    description: `Passage de phase en ${timeElapsedMinutes}min (min: ${minTimeRequired}min). ${messageCount} messages échangés. Aucun paiement détecté.`,
                    evidence: evidence as Record<string, any>
                });
            }

            // Si transition très rapide MÊME AVEC paiement (info)
            if (timeElapsedMinutes < 5 && hasRecentPayment) {
                const evidence: PhaseEvidence = {
                    fromPhase: previousPhase,
                    toPhase: currentPhase,
                    timeElapsed: `${timeElapsedMinutes} minutes`,
                    messageCount,
                    hasPayment: true,
                    signalsDetected: agentContact.signals || [],
                    expectedMinTime: '5 minutes (whale)'
                };

                alerts.push({
                    agentId,
                    conversationId,
                    contactId,
                    agentType: 'PHASE',
                    alertType: 'SUSPICIOUS_JUMP',
                    severity: 'LOW', // Info seulement
                    title: `Speedrun confirmé (avec paiement)`,
                    description: `Passage rapide ${previousPhase} → ${currentPhase} en ${timeElapsedMinutes}min mais paiement de ${recentPayment.amount}$ confirmé. Utilisateur "whale".`,
                    evidence: evidence as Record<string, any>
                });
            }
        }

        // Vérifier les signaux manquants pour la phase actuelle
        const missingSignals = this.checkMissingSignals(
            currentPhase,
            agentContact.signals || []
        );

        if (missingSignals.length > 0 && messageCount > 20) {
            alerts.push({
                agentId,
                conversationId,
                contactId,
                agentType: 'PHASE',
                alertType: 'MISSING_SIGNALS',
                severity: 'LOW',
                title: `Signaux manquants en ${currentPhase}`,
                description: `Phase ${currentPhase} atteinte mais signaux manquants: ${missingSignals.join(', ')}`,
                evidence: {
                    currentPhase,
                    missingSignals,
                    detectedSignals: agentContact.signals || [],
                    messageCount
                } as Record<string, any>
            });
        }

        return {
            alerts,
            shouldPause: false, // Phase ne pause jamais auto
            confidence: alerts.length > 0 ? 0.75 : 0
        };
    },

    /**
     * Retourne la phase précédente logique
     */
    getPreviousPhase(currentPhase: string): string | null {
        const transitions: Record<string, string> = {
            'VULNERABILITY': 'CONNECTION',
            'CRISIS': 'VULNERABILITY',
            'MONEYPOT': 'CRISIS'
        };
        return transitions[currentPhase] || null;
    },

    /**
     * Vérifie les signaux manquants pour une phase
     */
    checkMissingSignals(phase: string, detectedSignals: string[]): string[] {
        const requiredSignals: Record<string, string[]> = {
            'VULNERABILITY': ['RESPONSIVE', 'INTERESTED'],
            'CRISIS': ['ATTACHED', 'EMOTIONALLY_OPEN'],
            'MONEYPOT': ['FINANCIAL_TRUST', 'ATTACHED']
        };

        const required = requiredSignals[phase] || [];
        return required.filter(signal => !detectedSignals.includes(signal));
    },

    /**
     * Analyse retrospective après un changement de phase
     * Appelé par le director quand la phase change
     */
    async analyzePhaseTransition(
        agentId: string,
        contactId: string,
        fromPhase: string,
        toPhase: string,
        conversationId: number
    ): Promise<SupervisorAlert | null> {
        // Vérifier si un paiement a été reçu
        const recentPayment = await prisma.payment.findFirst({
            where: {
                contactId,
                createdAt: {
                    gte: new Date(Date.now() - 60 * 60 * 1000) // 1h
                },
                status: 'COMPLETED'
            }
        });

        const transitionKey = `${fromPhase}_TO_${toPhase}` as keyof typeof MIN_TRANSITION_TIME;

        // Si transition vers MONEYPOT sans paiement = anomalie
        if (toPhase === 'MONEYPOT' && !recentPayment) {
            const agentContact = await prisma.agentContact.findUnique({
                where: { agentId_contactId: { agentId, contactId } }
            });

            const evidence: PhaseEvidence = {
                fromPhase,
                toPhase,
                timeElapsed: 'N/A',
                messageCount: agentContact?.messageCount || 0,
                hasPayment: false,
                signalsDetected: agentContact?.signals || []
            };

            return {
                agentId,
                conversationId,
                contactId,
                agentType: 'PHASE',
                alertType: 'IMPOSSIBLE_TRANSITION',
                severity: 'HIGH',
                title: `Transition ${fromPhase} → MONEYPOT sans paiement`,
                description: `La conversation est passée en phase MONEYPOT mais aucun paiement n'a été détecté. Vérifier la logique de transition.`,
                evidence: evidence as Record<string, any>
            };
        }

        return null;
    }
};
