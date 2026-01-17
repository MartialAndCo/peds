// lib/handlers/admin.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { anthropic } from '@/lib/anthropic'
import { venice } from '@/lib/venice'
import { getAdminProblemAck, getAdminCancelAck, getAdminZeroPending } from '@/lib/spintax'

export async function handleAdminCommand(text: string, sourcePhone: string, settings: any, agentId?: number, messageKey?: any) {
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

    return { handled: false }
}
