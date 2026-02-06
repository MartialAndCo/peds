import { prisma } from '@/lib/prisma'
import { memoryService } from '@/lib/memory'

/**
 * Completely delete a contact and all associated data
 * This is the single source of truth for contact deletion across the app
 */
export async function deleteContactCompletely(contactId: string) {
    const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
            conversations: {
                select: { id: true, agentId: true }
            }
        }
    })

    if (!contact) {
        throw new Error('Contact not found')
    }

    const conversationIds = contact.conversations.map(c => c.id)
    const agentIds = [...new Set(contact.conversations.map(c => c.agentId).filter(Boolean))]

    // Use transaction for atomicity
    await prisma.$transaction(async (tx) => {
        // 1. Delete Mem0 memories (if phone exists)
        if (contact.phone_whatsapp) {
            // Global memories
            await memoryService.deleteAll(contact.phone_whatsapp)
            
            // Agent-specific memories
            for (const agentId of agentIds) {
                if (agentId) {
                    const uid = memoryService.buildUserId(contact.phone_whatsapp, agentId)
                    await memoryService.deleteAll(uid)
                }
            }
        }

        // 2. Delete messages in conversations
        if (conversationIds.length > 0) {
            await tx.message.deleteMany({
                where: { conversationId: { in: conversationIds } }
            })
            
            // Delete message queues linked to conversations
            await tx.messageQueue.deleteMany({
                where: { conversationId: { in: conversationIds } }
            })
        }

        // 3. Delete message queues linked directly to contact
        await tx.messageQueue.deleteMany({
            where: { contactId }
        })

        // 4. Delete conversations (cascades to: messages, trustLogs via schema cascade)
        await tx.conversation.deleteMany({
            where: { contactId }
        })

        // 5. Delete agent contacts
        await tx.agentContact.deleteMany({
            where: { contactId }
        })

        // 6. Delete signal logs (no cascade in schema)
        await tx.signalLog.deleteMany({
            where: { contactId }
        })

        // 7. Delete trust logs (cascade exists, but being explicit)
        await tx.trustLog.deleteMany({
            where: { contactId }
        })

        // 8. Delete pending payment claims
        await tx.pendingPaymentClaim.deleteMany({
            where: { contactId }
        })

        // 9. Handle payments - delete them (financial records are kept separately)
        await tx.payment.deleteMany({
            where: { contactId }
        })

        // 10. Delete pending requests (by phone number)
        if (contact.phone_whatsapp) {
            await tx.pendingRequest.deleteMany({
                where: { requesterPhone: contact.phone_whatsapp }
            })
        }

        // 11. Delete supervisor alerts
        await tx.supervisorAlert.deleteMany({
            where: { contactId }
        })

        // 12. Delete pending voice validations
        await tx.pendingVoiceValidation.deleteMany({
            where: { contactId }
        })

        // 13. Finally delete the contact
        // This cascades to: AgentContact (if any left), MessageQueue, etc.
        await tx.contact.delete({
            where: { id: contactId }
        })
    })

    return { success: true, deletedContactId: contactId }
}

/**
 * Delete a lead and its associated contact completely
 * Used when overwriting leads or admin deletion
 */
export async function deleteLeadAndContactCompletely(leadId: string) {
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: { contact: true }
    })

    if (!lead) {
        throw new Error('Lead not found')
    }

    // 1. Détacher le contact du lead (mettre contactId à null)
    // Sinon on ne peut pas supprimer le lead à cause de la contrainte FK
    await prisma.lead.update({
        where: { id: leadId },
        data: { contactId: null }
    })

    // 2. Delete lead (plus de référence vers contact)
    await prisma.lead.delete({
        where: { id: leadId }
    })

    // 3. Delete contact and all related data
    if (lead.contact) {
        await deleteContactCompletely(lead.contact.id)
    }

    return { success: true, deletedLeadId: leadId }
}
