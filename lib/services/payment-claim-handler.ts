import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { venice } from '@/lib/venice'
import { memoryService } from '@/lib/memory'
import { logger } from '@/lib/logger'
import { detectPaymentClaim, PaymentClaimResult } from './payment-detector'
import { sendPaymentClaimPush } from '@/lib/push-notifications'

/**
 * Process a user message for potential payment claims.
 * If detected, notifies admin and creates a pending claim.
 */
export async function processPaymentClaim(
    message: string,
    contact: any,
    conversation: any,
    settings: any,
    agentId?: string
): Promise<{ processed: boolean; claimId?: string }> {

    // Fetch conversation history for context (last 10 messages)
    let conversationHistory: Array<{ role: 'user' | 'ai', content: string }> = []

    if (conversation?.id) {
        try {
            const { prisma } = require('@/lib/prisma')
            const messages = await prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { timestamp: 'desc' },
                take: 10,
                select: { sender: true, message_text: true }
            })

            // Reverse to get chronological order and map to expected format
            conversationHistory = messages.reverse().map((m: any) => ({
                role: m.sender === 'contact' ? 'user' : 'ai',
                content: m.message_text
            }))
        } catch (e) {
            logger.error('Failed to fetch conversation history for payment detection', e as Error, { module: 'payment-claim' })
        }
    }

    // Detect payment claim with conversation context
    const detection = await detectPaymentClaim(message, settings, conversationHistory)

    if (!detection.claimed || detection.confidence < 0.7) {
        return { processed: false }
    }

    return notifyPaymentClaim(contact, conversation, settings, detection.amount || null, detection.method || null, agentId)
}

/**
 * Manually trigger a payment claim notification (e.g. from AI Tag)
 * NOW USES NATIVE NOTIFICATIONS + PUSH
 */
export async function notifyPaymentClaim(
    contact: any,
    conversation: any,
    settings: any,
    amount: number | null,
    method: string | null,
    agentId?: string,
    notificationType: 'claim' | 'verification_request' = 'claim'
): Promise<{ processed: boolean; claimId?: string }> {
    const isVerification = notificationType === 'verification_request'
    
    logger.info(isVerification ? 'Payment verification request detected' : 'Payment claim detected (Triggered)', {
        module: 'payment-claim',
        contactId: contact.id,
        amount,
        method,
        notificationType
    })

    // DEDUPLICATION: Check for recent pending claims (last 15 seconds) to prevent double notification
    // (e.g. User text detector + AI Tag detector both triggering)
    const recentClaim = await prisma.pendingPaymentClaim.findFirst({
        where: {
            contactId: contact.id,
            status: 'PENDING',
            createdAt: {
                gt: new Date(Date.now() - 60000) // 60 seconds window (Increased from 15s to prevent AI echo duplicates)
            }
        }
    })

    if (recentClaim) {
        logger.info(isVerification ? 'Duplicate verification request prevented' : 'Duplicate payment claim prevented (Debounce)', {
            module: 'payment-claim',
            contactId: contact.id,
            existingClaimId: recentClaim.id
        })
        return { processed: true, claimId: recentClaim.id }
    }

    const contactName = contact.name || contact.phone_whatsapp
    
    // Different message based on notification type
    let notificationTitle: string
    let notificationMsg: string
    let notificationTypeEnum: string
    
    if (isVerification) {
        // User is asking if we received the payment
        notificationTitle = 'Payment Verification Request'
        notificationMsg = `${contactName} is asking if you received their payment. Please check and confirm.`
        notificationTypeEnum = 'PAYMENT_VERIFICATION'
    } else {
        // User claims they sent payment
        const amountStr = amount ? `${amount}` : '?'
        const methodStr = method || 'unknown method'
        notificationTitle = 'New Payment Claim'
        notificationMsg = `${contactName} paid ${amountStr} with ${methodStr}`
        notificationTypeEnum = 'PAYMENT_CLAIM'
    }

    try {
        // 1. Create Pending Claim Record
        const claim = await prisma.pendingPaymentClaim.create({
            data: {
                contactId: contact.id,
                agentId: agentId || null, // Multi-agent: track which agent received this claim
                conversationId: conversation?.id,
                claimedAmount: amount || null,
                claimedMethod: method || null,
                status: 'PENDING'
            }
        })

        // 2. Create Notification Record (In-App)
        const notification = await prisma.notification.create({
            data: {
                title: notificationTitle,
                message: notificationMsg,
                type: notificationTypeEnum,
                agentId: agentId || null, // Multi-agent: agent-specific notification
                entityId: claim.id,
                metadata: {
                    amount: amount || null,
                    method: method || null,
                    contactName: contactName,
                    verificationType: notificationType,
                    userAskedVerification: isVerification
                }
            }
        })

        // 3. Send Push Notification (Device) - only for actual claims, not verification requests
        if (!isVerification) {
            const amountStr = amount ? `${amount}` : '?'
            const methodStr = method || 'unknown method'
            await sendPaymentClaimPush(
                contactName,
                amountStr,
                methodStr
            )
        }

        // 4. (Optional) Legacy WhatsApp Notification - DISABLED
        /*
        const adminPhone = settings.source_phone_number
        if (adminPhone) {
            await whatsapp.sendText(adminPhone, notificationMsg + "\nCheck app to approve.", undefined, agentId)
        }
        */

        logger.info('Payment claim notification created (Native + Push)', {
            module: 'payment-claim',
            claimId: claim.id,
            notificationId: notification.id
        })

        return { processed: true, claimId: claim.id }

    } catch (e) {
        logger.error('Failed to notify payment claim', e as Error, { module: 'payment-claim' })
        return { processed: false }
    }
}



/**
 * Core logic for approving/rejecting a claim.
 * Used by API and Legacy Reaction Handler.
 */
export async function processPaymentClaimDecision(
    claimId: string,
    action: 'CONFIRM' | 'REJECT',
    agentId?: string,
    settings?: any
): Promise<boolean> {

    const claim = await prisma.pendingPaymentClaim.findUnique({
        where: { id: claimId },
        include: { contact: true }
    })

    if (!claim || claim.status !== 'PENDING') return false

    // Fetch settings if not provided
    if (!settings) {
        // This assumes we can fetch settings globally or passed down. 
        // For now, let's fetch default settings if missing, or use minimal defaults.
        // In reality, we might need to fetch AgentSettings.
        // Let's assume broad defaults or fetch from DB if critical.
        const globalSettings = await prisma.setting.findMany()
        settings = globalSettings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
    }

    const isConfirm = action === 'CONFIRM'

    logger.info('Processing payment claim decision', {
        module: 'payment-claim',
        claimId: claim.id,
        action
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

    const effectiveAgentId = conversation?.agentId || agentId

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

        // NEW: Trigger escalation
        const { escalationService } = require('@/lib/services/payment-escalation')
        await escalationService.escalateOnPayment(
            effectiveAgentId || 'default',
            claim.contactId,
            Number(claim.claimedAmount || 0)
        )

        // 2. Inject memory
        const memUserId = memoryService.buildUserId(claim.contact.phone_whatsapp, effectiveAgentId as string)
        const memoryText = `User paid ${claim.claimedAmount || 'an amount'} via ${claim.claimedMethod || 'unknown method'}. Payment confirmed.`
        await memoryService.add(memUserId, memoryText)

        // 3. Update claim status
        await prisma.pendingPaymentClaim.update({
            where: { id: claim.id },
            data: { status: 'CONFIRMED' }
        })

        // 4. Update Contact Phase to MONEYPOT
        // 4. Update AgentContact Phase to MONEYPOT
        await prisma.agentContact.update({
            where: {
                agentId_contactId: {
                    agentId: effectiveAgentId || 'default', // Fallback safe
                    contactId: claim.contactId
                }
            },
            data: {
                phase: 'MONEYPOT',
                lastPhaseUpdate: new Date()
            }
        })

        // 5. Generate AI "Thank You" / Confirmation Response
        // Check if this was a verification request (user asked "did you receive?") or direct send
        const isVerificationRequest = false // Simplified - metadata field removed
        
        // Build Prompt for Confirmation
        const { director } = require('@/lib/director')
        const vKey = settings.venice_api_key || process.env.VENICE_API_KEY
        const vModel = settings.venice_model || 'venice-uncensored'

        if (vKey) {
            const history = conversation ? await prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { timestamp: 'desc' },
                take: 10
            }) : []

            const contextMessages = history.reverse().map((m: any) => ({
                role: m.sender === 'contact' ? 'user' : 'assistant',
                content: m.message_text
            }))

            const agentName = conversation?.prompt?.name || 'Lena'
            const amount = claim.claimedAmount || 'the money'
            const method = claim.claimedMethod || ''

            // Different prompt based on scenario
            const confirmSystemPrompt = isVerificationRequest 
                ? `You are ${agentName}, a friendly teenage girl chatting on WhatsApp.
You speak casually in short messages (3-10 words per message).
CURRENT SITUATION: You just checked your account and RECEIVED ${amount} ${method ? `via ${method}` : ''}! 
The user had asked if you received it, and you just confirmed you did.

CRITICAL RULES:
1. Express SURPRISE and JOY that the money arrived
2. Thank them genuinely but casually (not robotic)
3. Do NOT mention PayPal/Venmo unless they specifically used it
4. Keep it short, natural, and enthusiastic
5. Use emojis naturally (1-2 max)
6. NEVER use [PAYMENT_RECEIVED] tag here - this is AFTER confirmation
7. Vary your response - don't use the same words every time

Example responses (mix them up, be creative):
- "omg it arrived!! tysm 🥰"
- "yay i got it!! you're the best 💕"
- "just checked and it's there!! thanks so much 🙏"
- "received!! thank uuu 🥺💓"
- "omg yes i see it!! tysm babe 😘"`
                : `You are ${agentName}, a friendly teenage girl chatting on WhatsApp.
You speak casually in short messages (3-10 words per message).
CURRENT SITUATION: You RECEIVED ${amount} ${method ? `via ${method}` : ''}! 

CRITICAL RULES:
1. Express SURPRISE and JOY that the money arrived
2. Thank them genuinely but casually (not robotic)
3. Do NOT mention PayPal/Venmo unless they specifically used it
4. Keep it short, natural, and enthusiastic
5. Use emojis naturally (1-2 max)
6. NEVER use [PAYMENT_RECEIVED] tag here - this is AFTER confirmation
7. Vary your response - don't use the same words every time

Example responses (mix them up, be creative):
- "omg tysm!! just got it 🥰"
- "yay received!! you're amazing 💕"
- "got it!! thanks so much 🙏"
- "thank uuu i see it 🥺💓"
- "omg yes received!! tysm babe 😘"`

            try {
                let thankYouMsg = await venice.chatCompletion(
                    confirmSystemPrompt,
                    contextMessages.slice(-3),
                    contextMessages.length > 0 ? contextMessages[contextMessages.length - 1].content : 'I sent it',
                    { apiKey: vKey, model: vModel, temperature: 0.8 } // Higher temp for variety
                )
                thankYouMsg = thankYouMsg.replace(/\*[^*]+\*/g, '').replace(/\[PAYMENT_RECEIVED\]|\[PAIEMENT_REÇU\]|\[PAIEMENT_RECU\]/g, '').trim()

                await whatsapp.sendText(claim.contact.phone_whatsapp, thankYouMsg, undefined, effectiveAgentId as string)

                if (conversation) {
                    await prisma.message.create({
                        data: {
                            conversationId: conversation.id,
                            sender: 'ai',
                            message_text: thankYouMsg,
                            timestamp: new Date()
                        }
                    })
                }
            } catch (e) {
                logger.error('Failed to send confirmation thank you msg', e as Error)
            }
        }

    } else {
        // REJECTION

        // NEW: Track refusal for de-escalation
        const { escalationService } = require('@/lib/services/payment-escalation')
        await escalationService.deescalateOnRefusal(
            effectiveAgentId,
            claim.contactId
        )

        // Build Prompt for "Not Received"
        const { director } = require('@/lib/director')
        // We need settings for API keys.
        const vKey = settings.venice_api_key || process.env.VENICE_API_KEY
        const vModel = settings.venice_model || 'venice-uncensored'

        if (vKey) {
            const history = conversation ? await prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { timestamp: 'desc' },
                take: 10
            }) : []

            const contextMessages = history.reverse().map((m: any) => ({
                role: m.sender === 'contact' ? 'user' : 'ai',
                content: m.message_text
            }))

            // System Prompt - Use MINIMAL prompt for rejection (avoid PayPal in context)
            // The full systemPrompt contains PayPal info which causes the AI to mention it
            const agentName = conversation?.prompt?.name || 'Lena'

            const isVerificationRequest = false // Simplified - verification requests don't create claims
            
            const rejectSystemPrompt = `You are ${agentName}, a friendly teenage girl chatting on WhatsApp.
You speak casually in short messages (3-10 words per message).
CURRENT SITUATION: ${isVerificationRequest 
    ? "The user asked if you received money. You just checked ALL your accounts and NOTHING arrived." 
    : "The user claims they sent you money, but you just checked ALL your accounts and NOTHING arrived."}

CRITICAL RULES:
1. You MUST tell the user you have NOT received ANY money.
2. Do NOT mention PayPal, Venmo, CashApp, or ANY payment method.
3. Do NOT give your account info.
4. Do NOT say thank you.
5. Do NOT confirm any payment.
6. Be confused/surprised that they claim to have sent something.
7. Keep it short and natural.
8. VARY your response - use different words each time.
9. Use emojis naturally (0-1 max).

Example responses (be creative, mix them up):
- "wait what? i didnt get anything 🤔"
- "huh? nothing came through"
- "are u sure? i checked and theres nothing"
- "i just looked and i dont see anything"
- "my account is empty, didnt receive anything"
- "just checked, nothing arrived yet"
- "i dont see any payment, are u sure?"
- "checked everywhere, got nothing 😕"`

            try {
                let notReceivedMsg = await venice.chatCompletion(
                    rejectSystemPrompt,
                    contextMessages.slice(-3), // Only last 3 messages for context
                    contextMessages.length > 0 ? contextMessages[contextMessages.length - 1].content : 'I sent it',
                    { apiKey: vKey, model: vModel, temperature: 0.7 }
                )
                notReceivedMsg = notReceivedMsg.replace(/\*[^*]+\*/g, '').replace(/\[PAYMENT_RECEIVED\]|\[PAIEMENT_REÇU\]|\[PAIEMENT_RECU\]/g, '').trim()
                // Extra safety: Strip any PayPal mentions that might slip through
                notReceivedMsg = notReceivedMsg.replace(/paypal[:\s]?\w*/gi, '').replace(/lena\d+/gi, '').replace(/anais\.\w+/gi, '').trim()

                await whatsapp.sendText(claim.contact.phone_whatsapp, notReceivedMsg, undefined, effectiveAgentId as string)

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
                logger.error('Failed to send rejection msg', e as Error)
            }
        }

        // Update claim status
        await prisma.pendingPaymentClaim.update({
            where: { id: claim.id },
            data: { status: 'REJECTED' }
        })
    }

    return true
}

/**
 * Legacy Reaction Handler - Delegates to processPaymentClaimDecision
 */
export async function handlePaymentClaimReaction(
    messageId: string,
    reaction: string, // emoji
    settings: any,
    agentId?: string
): Promise<boolean> {

    const claim = await prisma.pendingPaymentClaim.findFirst({
        where: { waMessageId: messageId, status: 'PENDING' }
    })

    if (!claim) return false

    const isConfirm = ['👍', '❤️', '✅', '💚', '👌'].includes(reaction)
    const isReject = ['👎', '❌', '🚫', '💔'].includes(reaction)

    if (isConfirm) return processPaymentClaimDecision(claim.id, 'CONFIRM', agentId, settings)
    if (isReject) return processPaymentClaimDecision(claim.id, 'REJECT', agentId, settings)

    return false
}
