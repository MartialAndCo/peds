// lib/handlers/admin.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { anthropic } from '@/lib/anthropic'
import { venice } from '@/lib/venice'
import { getAdminProblemAck, getAdminCancelAck, getAdminZeroPending } from '@/lib/spintax'

export async function handleAdminCommand(text: string, sourcePhone: string, settings: any, agentId?: string, messageKey?: any) {
    const upperText = text.toUpperCase()

    // Mark as read immediately
    if (upperText.includes('[PROBLEM]') || upperText.includes('[CANCEL]') || upperText.includes('[ANNULER]')) {
        whatsapp.markAsRead(sourcePhone, agentId, messageKey).catch(() => { })
    }

    // A. [PROBLEM] - Report a problem
    if (upperText.includes('[PROBLEM]')) {
        const problemDesc = text.replace(new RegExp('\\[PROBLEM\\]', 'i'), '').trim()
        await whatsapp.sendText(sourcePhone, getAdminProblemAck(problemDesc), undefined, agentId)
        return { handled: true, type: 'source_problem' }
    }

    // B. [CANCEL] - Cancel pending request
    if (upperText.includes('[CANCEL]') || upperText.includes('[ANNULER]')) {
        const reason = text.replace(new RegExp('\\[CANCEL\\]|\\[ANNULER\\]', 'i'), '').trim()
        const pending = await prisma.pendingRequest.findFirst({ where: { status: 'pending' } })

        if (pending) {
            await prisma.pendingRequest.update({ where: { id: pending.id }, data: { status: 'cancelled' } })

            const baseMsg = getAdminCancelAck(reason)
            await whatsapp.sendText(sourcePhone, `${baseMsg}${reason ? ' Contact informé.' : ''}`, undefined, agentId)

            if (reason) {
                const contactPhone = pending.requesterPhone
                let currentConversation = await prisma.conversation.findFirst({
                    where: { contactId: (await prisma.contact.findUnique({ where: { phone_whatsapp: contactPhone } }))?.id, status: { in: ['active', 'paused'] } },
                    include: { prompt: true }
                })

                const clientAgentId = currentConversation?.agentId || undefined

                const systemMsg = `(SYSTEM: You promised a photo but realized you cannot send it. Reason: "${reason}". INSTRUCTION: Apologize naturally.)`
                const provider = settings.ai_provider || 'venice'
                let aiReply = ""
                try {
                    if (provider === 'anthropic') aiReply = await anthropic.chatCompletion(currentConversation?.prompt?.system_prompt || "Friend.", [], systemMsg, { apiKey: settings.anthropic_api_key, model: settings.anthropic_model })
                    else aiReply = await venice.chatCompletion(currentConversation?.prompt?.system_prompt || "Friend.", [], systemMsg, { apiKey: settings.venice_api_key, model: settings.venice_model })

                    await whatsapp.sendText(contactPhone, aiReply, undefined, clientAgentId)
                    if (currentConversation) await prisma.message.create({ data: { conversationId: currentConversation.id, sender: 'ai', message_text: aiReply, timestamp: new Date() } })
                } catch (e) {
                    console.error("Cancel AI Failed", e)
                }
            }
        } else {
            await whatsapp.sendText(sourcePhone, getAdminZeroPending(), undefined, agentId)
        }
        return { handled: true, type: 'source_cancel' }
    }

    // C. [RESET] - WIPE OUT CONTACT
    if (upperText.includes('[RESET]')) {
        const targetPhoneRaw = text.replace(new RegExp('\\[RESET\\]', 'i'), '').trim()

        // Normalize target phone
        let targetPhone = targetPhoneRaw.replace(/\s/g, '')
        if (!targetPhone.startsWith('+') && (targetPhone.startsWith('06') || targetPhone.startsWith('07'))) {
            targetPhone = '+33' + targetPhone.substring(1)
        }
        // If just +33... without spaces, ensure correct format if needed, but usually storage is +336...

        const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: targetPhone } })

        if (!contact) {
            await whatsapp.sendText(sourcePhone, `⚠️ Contact not found: ${targetPhone}`, undefined, agentId)
            return { handled: true, type: 'reset_failed' }
        }

        await whatsapp.sendText(sourcePhone, `⏳ Deleting EVERYTING for ${targetPhone}...`, undefined, agentId)

        try {
            // 1. Delete Memories (Mem0)
            const { memoryService } = require('@/lib/memory')
            // Delete global memories
            await memoryService.deleteAll(targetPhone)
            // Delete agent-specific memories (Try all agents? Or just the one?)
            // We can't easily know which agents they talked to without checking conversations first.
            // But we can check conversations.
            const convs = await prisma.conversation.findMany({ where: { contactId: contact.id } })
            const agentIds = [...new Set(convs.map(c => c.agentId).filter(id => id !== null))]

            for (const aid of agentIds) {
                const uid = memoryService.buildUserId(targetPhone, aid)
                await memoryService.deleteAll(uid)
            }

            // 2. Delete Database Records (Manual Cascade for safety)
            // Payment Claims
            await prisma.pendingPaymentClaim.deleteMany({ where: { contactId: contact.id } })

            // Payments (Optional: User might want to keep financial records? But "tout tout tout" implies wipe)
            // safer to nullify contactId than delete payment record if we want to keep accounting?
            // "Supprime bien tout" -> Delete.
            await prisma.payment.deleteMany({ where: { contactId: contact.id } })

            // Trust Logs
            await prisma.trustLog.deleteMany({ where: { contactId: contact.id } })

            // Message Queue
            await prisma.messageQueue.deleteMany({ where: { contactId: contact.id } })

            // Messages & Conversations handling
            // We delete messages first to be sure
            const convIds = convs.map(c => c.id)
            if (convIds.length > 0) {
                await prisma.message.deleteMany({ where: { conversationId: { in: convIds } } })
                await prisma.conversation.deleteMany({ where: { contactId: contact.id } })
            }

            // Finally: Delete Contact
            await prisma.contact.delete({ where: { id: contact.id } })

            await whatsapp.sendText(sourcePhone, `✅ WIPED: ${targetPhone}\n- Memories: Deleted\n- Conversations: Deleted\n- Payments/Logs: Deleted\n- Contact: Deleted\n\nIt is as if they never existed.`, undefined, agentId)

        } catch (e: any) {
            console.error('Reset Failed', e)
            await whatsapp.sendText(sourcePhone, `❌ Error resetting: ${e.message}`, undefined, agentId)
        }

        return { handled: true, type: 'reset_success' }
    }

    return { handled: false }
}
