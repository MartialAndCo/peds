"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { logger } from "@/lib/logger"

// Validate a scenario payment
export async function validateScenarioPayment(paymentId: string) {
    try {
        const payment = await prisma.scenarioPayment.findUnique({
            where: { id: paymentId },
            include: { contact: true, scenario: true }
        })

        if (!payment) return { success: false, error: "Payment not found" }

        await prisma.scenarioPayment.update({
            where: { id: paymentId },
            data: { status: 'VALIDATED' }
        })

        // We could also resolve the active scenario here if it's considered completed.
        // For now, let's just update the payment status.

        revalidatePath('/admin/payments')
        revalidatePath('/admin/scenarios')
        return { success: true }
    } catch (error: any) {
        logger.error('Failed to validate scenario payment', error)
        return { success: false, error: error.message || "Failed to validate payment" }
    }
}

// Reject a scenario payment (Trigger AI follow-up)
export async function rejectScenarioPayment(paymentId: string) {
    try {
        const payment = await prisma.scenarioPayment.findUnique({
            where: { id: paymentId },
            include: { contact: true, scenario: true }
        })

        if (!payment) return { success: false, error: "Payment not found" }
        if (payment.hasBeenUsedToRelance) {
            return { success: false, error: "Follow-up already sent for this payment." }
        }

        // 1. Update Payment Status
        await prisma.scenarioPayment.update({
            where: { id: paymentId },
            data: {
                status: 'FAILED',
                hasBeenUsedToRelance: true
            }
        })

        // 2. Trigger AI Follow-up
        const activeConversation = await prisma.conversation.findFirst({
            where: {
                contactId: payment.contactId,
                status: 'active'
            },
            orderBy: { createdAt: 'desc' }
        })

        if (activeConversation) {
            // Inject System Event to force the AI to complain about missing money
            await prisma.message.create({
                data: {
                    conversationId: activeConversation.id,
                    sender: 'system',
                    message_text: `[SYSTEM_EVENT]: L'utilisateur affirme avoir payé, mais L'ARGENT N'A PAS ÉTÉ REÇU. Tu dois IMMÉDIATEMENT lui envoyer un message pour dire que tu n'as rien reçu sur ton compte/wallet et lui demander s'il s'est pas trompé ou de réessayer. Garde le contexte du scénario ("${payment.scenario.title}").`,
                    status: 'READ'
                }
            })

            // Queue the orchestrator tick so it generates an instant reply
            await prisma.incomingQueue.create({
                data: {
                    agentId: activeConversation.agentId || 'default',
                    payload: {
                        type: 'SYSTEM_SCENARIO_PAYMENT_REJECTED',
                        contactId: payment.contactId,
                        scenarioId: payment.scenarioId,
                        conversationId: activeConversation.id
                    },
                    status: 'PENDING'
                }
            })

            logger.info(`Triggered AI payment rejection follow-up for contact ${payment.contactId}`)
        }

        revalidatePath('/admin/payments')
        revalidatePath('/admin/scenarios')
        return { success: true }
    } catch (error: any) {
        logger.error('Failed to reject scenario payment', error)
        return { success: false, error: error.message || "Failed to reject payment" }
    }
}
