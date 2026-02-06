/**
 * Supervisor Orchestrator
 * Coordonne les 4 agents de supervision et gère les alertes
 */

import { prisma } from '@/lib/prisma';
import { coherenceAgent } from './coherence-agent';
import { contextAgent } from './context-agent';
import { phaseAgent } from './phase-agent';
import { actionAgent } from './action-agent';
import { queueAgent } from './queue-agent';
import { sendSupervisorAlertPush } from '@/lib/push-notifications';
import type {
    AnalysisContext,
    SupervisorAlert,
    AlertSeverity
} from './types';

// Surveillance de la file d'attente
let queueMonitorInterval: NodeJS.Timeout | null = null;
const QUEUE_MONITOR_INTERVAL_MS = 30 * 1000; // 30 secondes

// Batch processing pour les alertes non-CRITICAL
let alertBatch: SupervisorAlert[] = [];
let batchTimeout: NodeJS.Timeout | null = null;
const BATCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const supervisorOrchestrator = {
    /**
     * Analyse une réponse IA en temps réel
     * Appelé après chaque génération de réponse IA
     */
    async analyzeResponse(context: AnalysisContext): Promise<void> {
        try {
            // Exécuter tous les agents en parallèle
            const [coherenceResult, contextResult, actionResult] = await Promise.all([
                coherenceAgent.analyze(context),
                contextAgent.analyze(context),
                actionAgent.analyze(context)
            ]);

            // PhaseAgent est plus lourd (requêtes DB), on le fait après
            const phaseResult = await phaseAgent.analyze(context);

            // Collecter toutes les alertes
            const allAlerts = [
                ...coherenceResult.alerts,
                ...contextResult.alerts,
                ...actionResult.alerts,
                ...phaseResult.alerts
            ];

            if (allAlerts.length === 0) return;

            // Déterminer si on doit pause la conversation
            const shouldPause = coherenceResult.shouldPause ||
                actionResult.shouldPause;

            // Traiter les alertes CRITICAL immédiatement
            const criticalAlerts = allAlerts.filter(a => a.severity === 'CRITICAL');
            const otherAlerts = allAlerts.filter(a => a.severity !== 'CRITICAL');

            // Traiter CRITICAL immédiatement
            for (const alert of criticalAlerts) {
                await this.processCriticalAlert(alert, context);
            }

            // Batch les autres alertes
            if (otherAlerts.length > 0) {
                this.batchAlerts(otherAlerts);
            }

            // Pause auto si nécessaire
            if (shouldPause && criticalAlerts.length > 0) {
                await this.pauseConversation(context.conversationId, criticalAlerts);
            }

        } catch (error) {
            console.error('[SupervisorOrchestrator] Analysis failed:', error);
        }
    },

    /**
     * Trouve une alerte active existante pour déduplication
     * Clé de déduplication: (agentId, contactId, alertType)
     */
    async findExistingActiveAlert(alert: SupervisorAlert): Promise<SupervisorAlert | null> {
        const existing = await prisma.supervisorAlert.findFirst({
            where: {
                agentId: alert.agentId,
                contactId: alert.contactId,
                alertType: alert.alertType,
                status: { in: ['NEW', 'INVESTIGATING'] }
            },
            orderBy: { createdAt: 'desc' }
        });
        return existing as SupervisorAlert | null;
    },

    /**
     * Traite une alerte CRITICAL immédiatement
     * Avec déduplication: met à jour une alerte existante si même (agentId, contactId, alertType)
     */
    async processCriticalAlert(alert: SupervisorAlert, context: AnalysisContext): Promise<void> {
        console.log(`[Supervisor] 🚨 CRITICAL ALERT: ${alert.title}`);

        // Vérifier si une alerte similaire existe déjà
        const existingAlert = await this.findExistingActiveAlert(alert);

        if (existingAlert) {
            console.log(`[Supervisor] ⚠️ Updating existing CRITICAL alert ${existingAlert.id} for ${alert.alertType}`);

            // Mettre à jour l'alerte existante avec les nouvelles infos
            const updatedSeverity = alert.severity === 'CRITICAL' ? 'CRITICAL' : existingAlert.severity;

            await prisma.supervisorAlert.update({
                where: { id: existingAlert.id },
                data: {
                    severity: updatedSeverity,
                    description: alert.description,
                    evidence: alert.evidence,
                    updatedAt: new Date()
                }
            });

            // Mettre à jour la conversation si elle existe
            const savedAlert = { ...existingAlert, ...alert, severity: updatedSeverity };

            // Pause auto si nécessaire (même logique que avant)
            if (alert.severity === 'CRITICAL') {
                await this.pauseConversation(context.conversationId, [savedAlert]);
            }

            return;
        }

        // 1. Sauvegarder dans la DB
        const savedAlert = await prisma.supervisorAlert.create({
            data: {
                agentId: alert.agentId,
                conversationId: alert.conversationId,
                contactId: alert.contactId,
                agentType: alert.agentType,
                alertType: alert.alertType,
                severity: alert.severity,
                title: alert.title,
                description: alert.description,
                evidence: alert.evidence,
                status: 'NEW',
                autoPaused: false
            }
        });

        // 2. Créer une notification dans le système existant
        await prisma.notification.create({
            data: {
                title: alert.title,
                message: alert.description.substring(0, 200),
                type: 'SYSTEM',
                entityId: savedAlert.id,
                metadata: {
                    supervisorAlert: true,
                    severity: alert.severity,
                    agentType: alert.agentType,
                    conversationId: alert.conversationId,
                    contactId: alert.contactId
                }
            }
        });

        // 3. Envoyer notification push (PWA) si disponible
        await this.sendPushNotification(alert);
    },

    /**
     * Batch les alertes non-CRITICAL
     */
    batchAlerts(alerts: SupervisorAlert[]): void {
        alertBatch.push(...alerts);

        // Démarrer le timer si pas déjà actif
        if (!batchTimeout) {
            batchTimeout = setTimeout(() => {
                this.processBatch();
            }, BATCH_INTERVAL_MS);
        }
    },

    /**
     * Traite le batch d'alertes
     * Avec déduplication: met à jour les alertes existantes plutôt que de créer des doublons
     */
    async processBatch(): Promise<void> {
        if (alertBatch.length === 0) return;

        const batchToProcess = [...alertBatch];
        alertBatch = [];
        batchTimeout = null;

        console.log(`[Supervisor] Processing batch of ${batchToProcess.length} alerts`);

        // Grouper par gravité (pour les stats)
        const highAlerts = batchToProcess.filter(a => a.severity === 'HIGH');
        const mediumAlerts = batchToProcess.filter(a => a.severity === 'MEDIUM');
        const lowAlerts = batchToProcess.filter(a => a.severity === 'LOW');

        // Traiter chaque alerte avec déduplication
        const createdAlerts: SupervisorAlert[] = [];
        const updatedAlerts: SupervisorAlert[] = [];

        for (const alert of batchToProcess) {
            // Vérifier si une alerte similaire existe déjà
            const existingAlert = await this.findExistingActiveAlert(alert);

            if (existingAlert) {
                // Mettre à jour l'alerte existante si la gravité est supérieure ou égale
                const shouldUpgrade = 
                    (alert.severity === 'CRITICAL' && existingAlert.severity !== 'CRITICAL') ||
                    (alert.severity === 'HIGH' && !['CRITICAL', 'HIGH'].includes(existingAlert.severity)) ||
                    (alert.severity === 'MEDIUM' && !['CRITICAL', 'HIGH', 'MEDIUM'].includes(existingAlert.severity));

                await prisma.supervisorAlert.update({
                    where: { id: existingAlert.id },
                    data: {
                        severity: shouldUpgrade ? alert.severity : existingAlert.severity,
                        description: alert.description,
                        evidence: alert.evidence,
                        updatedAt: new Date()
                    }
                });

                updatedAlerts.push({ ...existingAlert, ...alert, 
                    severity: shouldUpgrade ? alert.severity : existingAlert.severity 
                });
            } else {
                // Créer une nouvelle alerte
                await prisma.supervisorAlert.create({
                    data: {
                        agentId: alert.agentId,
                        conversationId: alert.conversationId,
                        contactId: alert.contactId,
                        agentType: alert.agentType,
                        alertType: alert.alertType,
                        severity: alert.severity,
                        title: alert.title,
                        description: alert.description,
                        evidence: alert.evidence,
                        status: 'NEW'
                    }
                });

                createdAlerts.push(alert);
            }
        }

        console.log(`[Supervisor] Batch processed: ${createdAlerts.length} created, ${updatedAlerts.length} updated`);

        // Créer une notification résumée si HIGH ou plusieurs MEDIUM (seulement pour les nouvelles)
        const newHighAlerts = createdAlerts.filter(a => a.severity === 'HIGH');
        const newMediumAlerts = createdAlerts.filter(a => a.severity === 'MEDIUM');

        if (newHighAlerts.length > 0 || newMediumAlerts.length >= 3) {
            const summaryTitle = newHighAlerts.length > 0
                ? `🟠 ${newHighAlerts.length} nouvelle(s) alerte(s) HIGH`
                : `🟡 ${newMediumAlerts.length} nouvelles alertes MEDIUM`;

            const summaryMessage = this.generateBatchSummary(newHighAlerts, newMediumAlerts, 
                createdAlerts.filter(a => a.severity === 'LOW'));

            await prisma.notification.create({
                data: {
                    title: summaryTitle,
                    message: summaryMessage.substring(0, 200),
                    type: 'SYSTEM',
                    metadata: {
                        supervisorAlert: true,
                        batchAlert: true,
                        highCount: newHighAlerts.length,
                        mediumCount: newMediumAlerts.length,
                        lowCount: createdAlerts.filter(a => a.severity === 'LOW').length,
                        updatedCount: updatedAlerts.length
                    }
                }
            });
        }
    },

    /**
     * Génère un résumé du batch
     */
    generateBatchSummary(high: SupervisorAlert[], medium: SupervisorAlert[], low: SupervisorAlert[]): string {
        const parts: string[] = [];

        if (high.length > 0) {
            const byType = this.groupBy(high, 'alertType');
            parts.push(`HIGH: ${Object.entries(byType).map(([t, c]) => `${t} (${c})`).join(', ')}`);
        }

        if (medium.length > 0) {
            const byType = this.groupBy(medium, 'alertType');
            parts.push(`MEDIUM: ${Object.entries(byType).map(([t, c]) => `${t} (${c})`).join(', ')}`);
        }

        return parts.join(' | ');
    },

    /**
     * Groupe un tableau par clé
     */
    groupBy<T>(array: T[], key: keyof T): Record<string, number> {
        return array.reduce((acc, item) => {
            const k = String(item[key]);
            acc[k] = (acc[k] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    },

    /**
     * Met en pause une conversation après une alerte CRITICAL
     */
    async pauseConversation(conversationId: number, criticalAlerts: SupervisorAlert[]): Promise<void> {
        try {
            await prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    status: 'paused',
                    metadata: {
                        pausedBy: 'SUPERVISOR',
                        pausedAt: new Date().toISOString(),
                        pauseReason: criticalAlerts.map(a => a.alertType).join(', '),
                        alerts: criticalAlerts.map(a => ({
                            type: a.alertType,
                            severity: a.severity,
                            title: a.title
                        }))
                    }
                }
            });

            console.log(`[Supervisor] Conversation ${conversationId} auto-paused due to CRITICAL alerts`);

            // Mettre à jour les alertes avec autoPaused
            await prisma.supervisorAlert.updateMany({
                where: {
                    conversationId,
                    severity: 'CRITICAL',
                    autoPaused: false
                },
                data: { autoPaused: true }
            });

        } catch (error) {
            console.error('[Supervisor] Failed to pause conversation:', error);
        }
    },

    /**
     * Envoie une notification push (PWA)
     */
    async sendPushNotification(alert: SupervisorAlert): Promise<void> {
        try {
            // Envoyer la notification push via le service centralisé
            await sendSupervisorAlertPush(
                alert.title,
                alert.description,
                alert.alertType,
                alert.severity
            );
            console.log(`[Supervisor] Push notification sent for alert: ${alert.alertType}`);
        } catch (error) {
            console.error('[Supervisor] Push notification failed:', error);
        }
    },

    /**
     * Force le traitement du batch (utile pour tests ou shutdown)
     */
    async flushBatch(): Promise<void> {
        if (batchTimeout) {
            clearTimeout(batchTimeout);
            batchTimeout = null;
        }
        await this.processBatch();
    },

    /**
     * Récupère les alertes pour le dashboard
     */
    async getAlerts(options: {
        status?: 'NEW' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
        severity?: AlertSeverity;
        agentId?: string;
        limit?: number;
        offset?: number;
    } = {}) {
        const { status, severity, agentId, limit = 50, offset = 0 } = options;

        const where: any = {};
        if (status) where.status = status;
        if (severity) where.severity = severity;
        if (agentId) where.agentId = agentId;

        const [alerts, total] = await Promise.all([
            prisma.supervisorAlert.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
                include: {
                    conversation: {
                        select: {
                            id: true,
                            status: true
                        }
                    },
                    contact: {
                        select: {
                            id: true,
                            name: true,
                            phone_whatsapp: true
                        }
                    }
                }
            }),
            prisma.supervisorAlert.count({ where })
        ]);

        // Statistiques par gravité
        const stats = await prisma.supervisorAlert.groupBy({
            by: ['severity'],
            where: { status: 'NEW' },
            _count: { severity: true }
        });

        return {
            alerts,
            total,
            stats: {
                critical: stats.find(s => s.severity === 'CRITICAL')?._count?.severity || 0,
                high: stats.find(s => s.severity === 'HIGH')?._count?.severity || 0,
                medium: stats.find(s => s.severity === 'MEDIUM')?._count?.severity || 0,
                low: stats.find(s => s.severity === 'LOW')?._count?.severity || 0
            }
        };
    },

    /**
     * Met à jour le statut d'une alerte
     */
    async updateAlertStatus(
        alertId: string,
        status: 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE',
        adminNotes?: string
    ): Promise<void> {
        await prisma.supervisorAlert.update({
            where: { id: alertId },
            data: {
                status,
                ...(adminNotes && { adminNotes })
            }
        });

        // Si résolue et que la conversation était paused, on pourrait la réactiver
        // Mais ça doit être manuel pour l'instant
    },

    /**
     * Récupère les statistiques par agent pour le dashboard
     */
    async getAgentHealth(agentId: string): Promise<{
        alertCount: number;
        criticalCount: number;
        recentAlerts: SupervisorAlert[];
        health: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    }> {
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [alertCount, criticalCount, recentAlerts] = await Promise.all([
            prisma.supervisorAlert.count({
                where: { agentId, createdAt: { gte: last24h } }
            }),
            prisma.supervisorAlert.count({
                where: { agentId, severity: 'CRITICAL', status: 'NEW' }
            }),
            prisma.supervisorAlert.findMany({
                where: { agentId },
                orderBy: { createdAt: 'desc' },
                take: 5
            }) as unknown as SupervisorAlert[]
        ]);

        let health: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
        if (criticalCount > 0) health = 'CRITICAL';
        else if (alertCount > 10) health = 'WARNING';

        return {
            alertCount,
            criticalCount,
            recentAlerts,
            health
        };
    },

    /**
     * Démarre la surveillance périodique de la file d'attente
     * À appeler au démarrage de l'application
     */
    startQueueMonitoring(): void {
        if (queueMonitorInterval) {
            console.log('[Supervisor] Queue monitoring already running');
            return;
        }

        console.log('[Supervisor] Starting queue monitoring (every 30s)');

        // Première exécution immédiate
        this.checkQueueForStuckMessages();

        // Puis toutes les 30 secondes
        queueMonitorInterval = setInterval(() => {
            this.checkQueueForStuckMessages();
        }, QUEUE_MONITOR_INTERVAL_MS);
    },

    /**
     * Arrête la surveillance de la file d'attente
     */
    stopQueueMonitoring(): void {
        if (queueMonitorInterval) {
            clearInterval(queueMonitorInterval);
            queueMonitorInterval = null;
            console.log('[Supervisor] Queue monitoring stopped');
        }
    },

    /**
     * Vérifie les messages bloqués en file d'attente
     * Appelé périodiquement par le timer
     */
    async checkQueueForStuckMessages(): Promise<void> {
        try {
            const result = await queueAgent.analyzeQueue('SYSTEM');

            if (result.alerts.length === 0) return;

            console.log(`[Supervisor] 🚨 ${result.alerts.length} message(s) stuck in queue detected`);

            // Traiter les alertes CRITICAL immédiatement
            const criticalAlerts = result.alerts.filter(a => a.severity === 'CRITICAL');
            const otherAlerts = result.alerts.filter(a => a.severity !== 'CRITICAL');

            for (const alert of criticalAlerts) {
                await this.processQueueAlert(alert);
            }

            // Batch les autres alertes
            if (otherAlerts.length > 0) {
                this.batchAlerts(otherAlerts);
            }

        } catch (error) {
            console.error('[Supervisor] Queue monitoring failed:', error);
        }
    },

    /**
     * Traite une alerte de file d'attente
     * Similaire à processCriticalAlert mais pour les alertes QUEUE
     */
    async processQueueAlert(alert: SupervisorAlert): Promise<void> {
        // Deduplication: Check for existing active alerts for this queue item
        // We fetch active queue alerts and check evidence in memory to avoid complex JSON queries
        const activeQueueAlerts = await prisma.supervisorAlert.findMany({
            where: {
                agentType: 'QUEUE',
                status: { in: ['NEW', 'INVESTIGATING'] },
                // Optional optimization: Filter by agentId if we trust attribution
                agentId: alert.agentId
            }
        });

        const targetQueueItemId = (alert.evidence as any).queueItemId;
        const existingAlert = activeQueueAlerts.find(a => (a.evidence as any)?.queueItemId === targetQueueItemId);

        if (existingAlert) {
            console.log(`[Supervisor] ⚠️ Updating existing alert ${existingAlert.id} for queue item ${targetQueueItemId}`);

            // Update existing alert
            await prisma.supervisorAlert.update({
                where: { id: existingAlert.id },
                data: {
                    severity: alert.severity, // Upgrade severity if needed
                    description: alert.description, // Update description with new delay
                    evidence: alert.evidence, // Update evidence
                    updatedAt: new Date()
                }
            });
            return; // Stop here, do not create new alert or notification
        }

        console.log(`[Supervisor] 🚨 QUEUE ALERT: ${alert.title}`);

        // 1. Sauvegarder dans la DB
        const savedAlert = await prisma.supervisorAlert.create({
            data: {
                agentId: alert.agentId,
                conversationId: alert.conversationId,
                contactId: alert.contactId,
                agentType: alert.agentType,
                alertType: alert.alertType,
                severity: alert.severity,
                title: alert.title,
                description: alert.description,
                evidence: alert.evidence,
                status: 'NEW',
                autoPaused: false
            }
        });

        // 2. Créer une notification dans le système existant
        await prisma.notification.create({
            data: {
                title: alert.title,
                message: alert.description.substring(0, 200),
                type: 'SYSTEM',
                entityId: savedAlert.id,
                metadata: {
                    supervisorAlert: true,
                    severity: alert.severity,
                    agentType: alert.agentType,
                    conversationId: alert.conversationId,
                    contactId: alert.contactId,
                    queueAlert: true
                }
            }
        });

        // 3. Notification push si CRITICAL
        if (alert.severity === 'CRITICAL') {
            await this.sendPushNotification(alert);
        }
    }
};

// Export pour usage dans les hooks
export { coherenceAgent, contextAgent, phaseAgent, actionAgent, queueAgent };
