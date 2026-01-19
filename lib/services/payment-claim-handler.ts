import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { venice } from '@/lib/venice'
import { memoryService } from '@/lib/memory'
import { logger } from '@/lib/logger'
import { detectPaymentClaim, PaymentClaimResult } from './payment-detector'

/**
 * Process a user message for potential payment claims.
 * If detected, notifies admin and creates a pending claim.
 */
export async function processPaymentClaim(
    message: string,
    contact: any,
    conversation: any,
    settings: any,
    agentId?: number
): Promise<{ processed: boolean; claimId?: string }> {

    // Detect payment claim
    const detection = await detectPaymentClaim(message, settings)

    if (!detection.claimed || detection.confidence < 0.7) {
        return { processed: false }
    }

    return notifyPaymentClaim(contact, conversation, settings, detection.amount || null, detection.method || null, agentId)
}

/**
 * Manually trigger a payment claim notification (e.g. from AI Tag)
 */
export async function notifyPaymentClaim(
    contact: any,
    conversation: any,
    settings: any,
    amount: number | null,
    method: string | null,
    agentId?: number
): Promise<{ processed: boolean; claimId?: string }> {
    logger.info('Payment claim detected (Triggered)', {
        module: 'payment-claim',
        contactId: contact.id,
        amount,
        method
    })

    // Build notification message for admin
    const contactName = contact.name || contact.phone_whatsapp
    const amountStr = amount ? `${amount}` : '?'
    const methodStr = method || 'unknown method'

    // Natural sentence format (English): "Tom paid 50$ with Paypal"
    const notificationMsg = `${contactName} paid ${amountStr} with ${methodStr}`

    // Send to admin
    const adminPhone = settings.source_phone_number
    if (!adminPhone) {
        logger.warn('No admin phone configured, cannot notify payment claim', { module: 'payment-claim' })
        return { processed: false }
    }

    try {
        const sendResult = await whatsapp.sendText(adminPhone, notificationMsg, undefined, agentId)

        console.log('[PaymentClaim] Raw Send Result:', JSON.stringify(sendResult, null, 2))

        // Fix ID extraction: Support flat ID, nested ID, or key.id
        // Baileys 'sendMessage' usually returns { key: { id: "..." } } 
        // Our Microservice might wrap it in { id: "..." } or { id: { id: "..." } }
        let waMessageId: string | null = null

        if (sendResult?.key?.id) {
            waMessageId = sendResult.key.id
        } else if (typeof sendResult?.id === 'string') {
            waMessageId = sendResult.id
        } else if (sendResult?.id?.id) {
            waMessageId = sendResult.id.id
        }

        console.log(`[PaymentClaim] Extracted waMessageId: "${waMessageId}"`)

        // Create pending claim record
        const claim = await prisma.pendingPaymentClaim.create({
            data: {
                contactId: contact.id,
                conversationId: conversation?.id,
                waMessageId: waMessageId,
                claimedAmount: amount || null,
                claimedMethod: method || null,
                status: 'PENDING'
            }
        })

        logger.info('Payment claim notification sent to admin', {
            module: 'payment-claim',
            claimId: claim.id,
            waMessageId
        })

        return { processed: true, claimId: claim.id }

    } catch (e) {
        logger.error('Failed to send payment claim notification', e as Error, { module: 'payment-claim' })
        return { processed: false }
    }
}

/**
 * Handle admin reaction to a payment claim notification.
 * Called when a reaction event is received on a message.
 */
export async function handlePaymentClaimReaction(
    messageId: string,
    reaction: string, // emoji
    settings: any,
    agentId?: number
): Promise<boolean> {

    // Find the claim by waMessageId
    const claim = await prisma.pendingPaymentClaim.findFirst({
        where: { waMessageId: messageId, status: 'PENDING' },
        include: { contact: true }
    })

    if (!claim) {
        logger.warn('Reaction received but no matching Pending Claim found', { messageId, reaction, module: 'payment-claim' })
        return false // Not a payment claim message
    }

    const isConfirm = ['👍', '❤️', '✅', '💚', '👌'].includes(reaction)
    const isReject = ['👎', '❌', '🚫', '💔'].includes(reaction)

    if (!isConfirm && !isReject) {
        return false // Unknown reaction
    }

    logger.info('Processing payment claim reaction', {
        module: 'payment-claim',
        claimId: claim.id,
        reaction,
        action: isConfirm ? 'CONFIRM' : 'REJECT'
    })

    // Get conversation for AI response
    const conversation = claim.conversationId
        ? await prisma.conversation.findUnique({
            where: { id: claim.conversationId },
            include: { prompt: true, contact: true }
        })
        : await prisma.conversation.findFirst({
            where: { contactId: claim.contactId, status: 'active' },
            include: { prompt: true, contact: true }
        })

    const { director } = require('@/lib/director')
    const effectiveAgentId = conversation?.agentId || agentId || claim.contact.id // Fallback 
    const { phase, details } = await director.determinePhase(claim.contact.phone_whatsapp)
    const systemPrompt = await director.buildSystemPrompt(
        settings,
        claim.contact,
        phase,
        details,
        conversation?.prompt?.system_prompt || "You are a friendly assistant.",
        effectiveAgentId
    )

    if (isConfirm) {
        // 1. Create Payment record
        await prisma.payment.create({
            data: {
                id: `manual_${Date.now()}`,
                amount: claim.claimedAmount || 0,
                currency: 'USD',
                status: 'COMPLETED',
                payerName: claim.contact.name,
                contactId: claim.contactId,
                method: claim.claimedMethod || 'manual'
            }
        })

        // 2. Inject memory
        const memUserId = memoryService.buildUserId(claim.contact.phone_whatsapp, agentId)
        const memoryText = `User paid ${claim.claimedAmount || 'an amount'} via ${claim.claimedMethod || 'unknown method'}. Payment confirmed.`
        await memoryService.add(memUserId, memoryText)

        // NOTE: No thank you message sent here - the AI already responded naturally
        // to the user's payment claim. Sending another would be redundant.

        // 3. Update claim status
        await prisma.pendingPaymentClaim.update({
            where: { id: claim.id },
            data: { status: 'CONFIRMED' }
        })

        // 4. Update Contact Phase to MONEYPOT
        await prisma.contact.update({
            where: { id: claim.contactId },
            data: {
                agentPhase: 'MONEYPOT',
                lastPhaseUpdate: new Date()
            }
        })

        logger.info('Payment claim confirmed (silent) & Contact moved to MONEYPOT', { module: 'payment-claim', claimId: claim.id })

    } else {
        // REJECTION: Not received

        // Fetch recent history to ensure the response is personalized and context-aware
        const history = conversation ? await prisma.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { timestamp: 'desc' },
            take: 10
        }) : []

        const contextMessages = history.reverse().map((m: any) => ({
            role: m.sender === 'contact' ? 'user' : 'ai',
            content: m.message_text
        }))

        // Extract last user content for context
        const lastContent = contextMessages[contextMessages.length - 1]?.content || 'I sent the money'

        // User Request: "Tell Lilia he claimed to send money but she didn't receive it, so she answers personalized."
        const rejectInstruction = `\n\n[SYSTEM UPDATE]: The user claims to have sent a payment (Money/Transfer). You just checked your ACTUAL bank account/wallet and NOTHING has arrived. The balance has not changed. You must tell the user that you have NOT received it. Be natural, reference the context if needed, but be firm that the money is not there.`

        try {
            let notReceivedMsg = await venice.chatCompletion(
                systemPrompt + rejectInstruction,
                contextMessages,
                lastContent || 'I sent the money', // Use actual last message if available, or fallback
                { apiKey: settings.venice_api_key, model: settings.venice_model || 'venice-uncensored' }
            )
            notReceivedMsg = notReceivedMsg.replace(/\*[^*]+\*/g, '').trim()

            await whatsapp.sendText(claim.contact.phone_whatsapp, notReceivedMsg, undefined, agentId)

            // Save message to conversation
            if (conversation) {
                await prisma.message.create({
                    data: {
                        conversationId: conversation.id,
                        sender: 'ai',
                        message_text: notReceivedMsg,
                        timestamp: new Date()
                    }
                })
            }
        } catch (e) {
            logger.error('Failed to send not-received message', e as Error, { module: 'payment-claim' })
        }

        // Update claim status
        await prisma.pendingPaymentClaim.update({
            where: { id: claim.id },
            data: { status: 'REJECTED' }
        })

        logger.info('Payment claim rejected', { module: 'payment-claim', claimId: claim.id })
    }

    return true
}
