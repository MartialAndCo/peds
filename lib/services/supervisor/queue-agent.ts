/**
 * Queue Agent - Supervision de la file d'attente de messages
 * Détecte les messages bloqués en file d'attente éclair depuis trop longtemps
 */

import { prisma } from '@/lib/prisma';
import type { SupervisorAlert, AgentAnalysisResult, QueueEvidence } from './types';

// Seuils d'alerte (en minutes)
const WARNING_THRESHOLD_MINUTES = 1;  // Alert MEDIUM après 1 minute
const ERROR_THRESHOLD_MINUTES = 2;    // Alert HIGH après 2 minutes
const CRITICAL_THRESHOLD_MINUTES = 5; // Alert CRITICAL après 5 minutes

export const queueAgent = {
    /**
     * Analyse la file d'attente pour détecter les messages bloqués
     * Cette méthode est appelée périodiquement par l'orchestrateur
     */
    async analyzeQueue(agentId?: string): Promise<AgentAnalysisResult> {
        const now = new Date();
        const alerts: SupervisorAlert[] = [];

        try {
            // Chercher les messages PENDING dont le scheduledAt est passé depuis > 1 minute
            const stuckMessages = await prisma.messageQueue.findMany({
                where: {
                    status: 'PENDING',
                    scheduledAt: {
                        lte: new Date(now.getTime() - WARNING_THRESHOLD_MINUTES * 60 * 1000)
                    }
                },
                include: {
                    contact: true,
                    conversation: true
                },
                orderBy: { scheduledAt: 'asc' }
            });

            for (const msg of stuckMessages) {
                const scheduledAt = new Date(msg.scheduledAt);
                const delayMinutes = Math.floor((now.getTime() - scheduledAt.getTime()) / 60000);

                let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
                let alertType: 'STUCK_IN_QUEUE' | 'QUEUE_OVERDUE' = 'STUCK_IN_QUEUE';

                if (delayMinutes >= CRITICAL_THRESHOLD_MINUTES) {
                    severity = 'CRITICAL';
                    alertType = 'QUEUE_OVERDUE';
                } else if (delayMinutes >= ERROR_THRESHOLD_MINUTES) {
                    severity = 'HIGH';
                    alertType = 'STUCK_IN_QUEUE';
                } else {
                    severity = 'MEDIUM';
                    alertType = 'STUCK_IN_QUEUE';
                }

                const evidence: QueueEvidence = {
                    queueItemId: msg.id,
                    scheduledAt: scheduledAt.toISOString(),
                    currentTime: now.toISOString(),
                    delayMinutes,
                    contactPhone: msg.contact?.phone_whatsapp || undefined,
                    messagePreview: msg.content?.substring(0, 100) || '[Media/Voice]',
                    status: msg.status
                };

                const alert: SupervisorAlert = {
                    id: `queue-${msg.id}`, // Stable ID
                    agentId: msg.conversation?.agentId || agentId || 'SYSTEM',
                    conversationId: msg.conversationId || 0,
                    contactId: msg.contactId,
                    agentType: 'QUEUE',
                    alertType,
                    severity,
                    title: `🚨 Message bloqué en file d'attente (${delayMinutes} min)`,
                    description: `Un message en file d'attente éclair n'a pas été envoyé alors qu'il était prévu pour ${scheduledAt.toLocaleTimeString()}. ` +
                        `Retard actuel: ${delayMinutes} minute(s). ` +
                        `Contact: ${msg.contact?.phone_whatsapp || 'N/A'}. ` +
                        `Le message pourrait ne jamais être envoyé si le système de queue ne fonctionne pas correctement.`,
                    evidence
                };

                alerts.push(alert);

                console.log(`[QueueAgent] ⚠️ Alert generated: Message ${msg.id} stuck for ${delayMinutes} minutes`);
            }

        } catch (error) {
            console.error('[QueueAgent] Failed to analyze queue:', error);
        }

        return {
            alerts,
            shouldPause: false, // Le queue agent ne met pas en pause les conversations
            confidence: 1.0
        };
    },

    /**
     * Vérifie si un message spécifique est bloqué
     * Utile pour les vérifications ponctuelles
     */
    async checkMessage(queueItemId: string): Promise<SupervisorAlert | null> {
        const now = new Date();

        try {
            const msg = await prisma.messageQueue.findUnique({
                where: { id: queueItemId },
                include: { contact: true, conversation: true }
            });

            if (!msg || msg.status !== 'PENDING') {
                return null;
            }

            const scheduledAt = new Date(msg.scheduledAt);
            const delayMinutes = Math.floor((now.getTime() - scheduledAt.getTime()) / 60000);

            if (delayMinutes < WARNING_THRESHOLD_MINUTES) {
                return null; // Pas encore de problème
            }

            let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
            if (delayMinutes >= CRITICAL_THRESHOLD_MINUTES) {
                severity = 'CRITICAL';
            } else if (delayMinutes >= ERROR_THRESHOLD_MINUTES) {
                severity = 'HIGH';
            }

            const evidence: QueueEvidence = {
                queueItemId: msg.id,
                scheduledAt: scheduledAt.toISOString(),
                currentTime: now.toISOString(),
                delayMinutes,
                contactPhone: msg.contact?.phone_whatsapp || undefined,
                messagePreview: msg.content?.substring(0, 100) || '[Media/Voice]',
                status: msg.status
            };

            return {
                id: `queue-${msg.id}`, // Stable ID based on queue item ID
                agentId: msg.conversation?.agentId || 'SYSTEM',
                conversationId: msg.conversationId || 0,
                contactId: msg.contactId,
                agentType: 'QUEUE',
                alertType: delayMinutes >= CRITICAL_THRESHOLD_MINUTES ? 'QUEUE_OVERDUE' : 'STUCK_IN_QUEUE',
                severity,
                title: `🚨 Message bloqué en file d'attente (${delayMinutes} min)`,
                description: `Un message en file d'attente éclair n'a pas été envoyé alors qu'il était prévu pour ${scheduledAt.toLocaleTimeString()}. ` +
                    `Retard actuel: ${delayMinutes} minute(s). ` +
                    `Contact: ${msg.contact?.phone_whatsapp || 'N/A'}.`,
                evidence
            };

        } catch (error) {
            console.error('[QueueAgent] Failed to check message:', error);
            return null;
        }
    }
};
