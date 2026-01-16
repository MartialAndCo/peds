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

    logger.info('Payment claim detected', {
        module: 'payment-claim',
        contactId: contact.id,
        amount: detection.amount,
        method: detection.method
    })

    // Build notification message for admin
    const contactName = contact.name || contact.phone_whatsapp
    const amountStr = detection.amount ? `${detection.amount}` : '?'
    const methodStr = detection.method || 'unknown method'

    // Simple format as requested: "Tom dit avoir payé 50€ via WhatsApp"
    const notificationMsg = `💰 ${contactName} claims to have paid ${amountStr} via ${methodStr}`

    // Send to admin
    const adminPhone = settings.source_phone_number
    if (!adminPhone) {
        logger.warn('No admin phone configured, cannot notify payment claim', { module: 'payment-claim' })
        return { processed: false }
    }

    try {
        const sendResult = await whatsapp.sendText(adminPhone, notificationMsg, undefined, agentId)
        const waMessageId = sendResult?.id || sendResult?.key?.id || null

        // Create pending claim record
        const claim = await prisma.pendingPaymentClaim.create({
            data: {
                contactId: contact.id,
                conversationId: conversation?.id,
                waMessageId: waMessageId,
                claimedAmount: detection.amount || null,
                claimedMethod: detection.method || null,
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
            include: { prompt: true }
        })
        : await prisma.conversation.findFirst({
            where: { contactId: claim.contactId, status: 'active' },
            include: { prompt: true }
        })

    const systemPrompt = conversation?.prompt?.system_prompt || "You are a friendly assistant."

    if (isConfirm) {
        // 1. Create Payment record
        await prisma.payment.create({
            data: {
                id: `manual_${Date.now()}`,
                amount: claim.claimedAmount || 0,
                currency: 'USD',
                status: 'COMPLETED',
                payerName: claim.contact.name,
                contactId: claim.contactId
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

        logger.info('Payment claim confirmed (silent)', { module: 'payment-claim', claimId: claim.id })

    } else {
        // REJECTION: Not received

        // Generate "didn't receive" response (AI, not hardcoded)
        const rejectPrompt = `(SYSTEM: The user claimed they sent payment, but you haven't received it yet. Express confusion/concern naturally. Don't accuse them. Suggest maybe there's a delay or ask them to double-check. Stay in character and be gentle.)`

        try {
            let notReceivedMsg = await venice.chatCompletion(
                systemPrompt + rejectPrompt,
                [],
                'I sent you the money!', // Dummy user msg for context
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
