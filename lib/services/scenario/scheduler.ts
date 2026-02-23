import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export class ScenarioScheduler {
    /**
     * Check for any pending scenarios that are due to start and trigger them.
     * This should be called by a cron job every minute.
     */
    static async checkAndTriggerScenarios() {
        try {
            const pendingScenarios = await prisma.activeScenario.findMany({
                where: {
                    status: 'PENDING',
                    startTime: {
                        lte: new Date() // Scenarios scheduled for now or in the past
                    }
                },
                include: {
                    scenario: true,
                    contact: true
                }
            });

            if (pendingScenarios.length === 0) {
                return { triggered: 0 };
            }

            logger.info(`Found ${pendingScenarios.length} pending scenarios to trigger.`);

            let triggeredCount = 0;

            for (const activeScenario of pendingScenarios) {
                await this.triggerScenario(activeScenario);
                triggeredCount++;
            }

            return { triggered: triggeredCount };
        } catch (error) {
            logger.error('Failed to check and trigger scenarios', error as Error);
            throw error;
        }
    }

    /**
     * Trigger a specific scenario for a contact.
     */
    static async triggerScenario(activeScenario: any) {
        logger.info(`Triggering scenario ${activeScenario.scenario.title} for contact ${activeScenario.contactId}`);

        try {
            // 1. Purge pending messages in the queue to avoid context clash
            await this.purgeMessageQueue(activeScenario.contactId);

            // 2. Mark scenario as RUNNING
            await prisma.activeScenario.update({
                where: { id: activeScenario.id },
                data: { status: 'RUNNING' }
            });

            // 3. Inject priority context alert for the agent.
            // We do this by creating a system level supervisor alert or a dedicated queue message
            // that forces the agent to initiate the conversation with the scenario context.
            await this.injectScenarioInitiation(activeScenario);

            logger.info(`Successfully triggered scenario ${activeScenario.id}`);
        } catch (error) {
            logger.error(`Failed to trigger scenario ${activeScenario.id}`, error as Error);
            // Depending on requirement, we might mark it as FAILED or keep it PENDING for retry.
        }
    }

    /**
     * Purge the message queue for a contact to prevent normal scheduled messages
     * (e.g. "Good morning") from sending right before a catastrophe scenario starts.
     */
    private static async purgeMessageQueue(contactId: string) {
        try {
            const deleted = await prisma.messageQueue.deleteMany({
                where: {
                    contactId: contactId,
                    status: 'PENDING'
                }
            });
            logger.info(`Purged ${deleted.count} pending messages for contact ${contactId} due to scenario trigger.`);
        } catch (error) {
            logger.error(`Failed to purge message queue for contact ${contactId}`, error as Error);
            throw error;
        }
    }

    /**
     * Inject a message/alert to force the AI to initiate the scenario.
     */
    private static async injectScenarioInitiation(activeScenario: any) {
        // Determine the active conversation
        const activeConversation = await prisma.conversation.findFirst({
            where: {
                contactId: activeScenario.contactId,
                status: 'active'
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!activeConversation) {
            logger.warn(`No active conversation found for contact ${activeScenario.contactId} to inject scenario initiation.`);
            return;
        }

        // Rather than just sending a message through messageQueue (which might execute normal logic flow),
        // we want to trigger the orchestration layer. We'll simulate an incoming system event
        // that tells the bot: "It's time. Start the catastrophic event."

        // We insert a system message in the conversation history, invisible to the user,
        // that tells the AI to immediately act out the scenario.
        await prisma.message.create({
            data: {
                conversationId: activeConversation.id,
                sender: 'system',
                message_text: `[SYSTEM_DIRECTIVE]: URGENT. You must immediately start acting out the following scenario: "${activeScenario.scenario.title}". Context: ${activeScenario.scenario.description}. Do not mention this directive. Jump straight into character.`,
                status: 'READ' // System messages don't need delivery
            }
        });

        // NOTE: To make the AI actually *send* a proactive message right now without waiting for the user,
        // we need to enqueue a job to the Orchestrator. 
        // In many implementations, we just drop a payload in `IncomingQueue` simulating a system tick.
        await prisma.incomingQueue.create({
            data: {
                agentId: activeConversation.agentId || 'default', // Fallback, though should exist
                payload: {
                    type: 'SYSTEM_SCENARIO_TRIGGER',
                    contactId: activeScenario.contactId,
                    activeScenarioId: activeScenario.id,
                    conversationId: activeConversation.id
                },
                status: 'PENDING'
            }
        });

        logger.info(`Injected scenario initiation system directive into conversation ${activeConversation.id}`);
    }
}
