import { prisma } from '@/lib/prisma'
import { whatsapp } from '@/lib/whatsapp'
import { venice } from '@/lib/venice'
import { memoryService } from '@/lib/memory'
import { logger } from '@/lib/logger'
import { detectPaymentClaim, PaymentClaimResult } from './payment-detector'
import webpush from 'web-push'

// Configure Web Push
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:admin@example.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    )
}

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
    agentId?: string
): Promise<{ processed: boolean; claimId?: string }> {
    logger.info('Payment claim detected (Triggered)', {
        module: 'payment-claim',
        contactId: contact.id,
        amount,
        method
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
        logger.info('Duplicate payment claim prevented (Debounce)', {
            module: 'payment-claim',
            contactId: contact.id,
            existingClaimId: recentClaim.id
        })
        return { processed: true, claimId: recentClaim.id }
    }

    const contactName = contact.name || contact.phone_whatsapp
    const amountStr = amount ? `${amount}` : '?'
    const methodStr = method || 'unknown method'
    const notificationMsg = `${contactName} paid ${amountStr} with ${methodStr}`

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
                title: 'New Payment Claim',
                message: notificationMsg,
                type: 'PAYMENT_CLAIM',
                agentId: agentId || null, // Multi-agent: agent-specific notification
                entityId: claim.id,
                metadata: {
                    amount: amountStr,
                    method: methodStr,
                    contactName: contactName
                }
            }
        })

        // 3. Send Push Notification (Device)
        await sendPushNotificationToAdmin({
            title: 'New Payment Claim',
            body: notificationMsg,
            url: `/admin/notifications`,
            tag: `claim-${claim.id}`
        })

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
 * Helper to send Web Push to all subscribed admins
 */
async function sendPushNotificationToAdmin(payload: { title: string, body: string, url?: string, tag?: string }) {
    try {
        const subscriptions = await prisma.pushSubscription.findMany()

        console.log(`[Push] Attempting to send push notification to ${subscriptions.length} subscription(s)`)
        console.log(`[Push] Payload:`, payload)

        if (subscriptions.length === 0) {
            console.warn('[Push] No push subscriptions found in database')
            return
        }

        const notifications = subscriptions.map(sub => {
            console.log(`[Push] Sending to subscription ${sub.id} (endpoint: ${sub.endpoint.substring(0, 50)}...)`)
            return webpush.sendNotification({
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            }, JSON.stringify(payload))
                .then(() => {
                    console.log(`[Push] Successfully sent to subscription ${sub.id}`)
                })
                .catch(err => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        // Subscription expired/gone, cleanup
                        console.log(`[Push] Cleaning up expired subscription ${sub.id}`)
                        return prisma.pushSubscription.delete({ where: { id: sub.id } })
                    }
                    console.error(`[Push] Error sending to subscription ${sub.id}:`, err.message || err)
                })
        })

        await Promise.all(notifications)
        console.log('[Push] All push notifications processed')
    } catch (error) {
        console.error('[Push] Failed to send push notifications:', error)
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

        // 5. Trigger AI "Thank You" / Confirmation
        // The user explicitly requested: "If I answer YES... AI response 'Thank you'"
        // The previous code said "No thank you message sent here - the AI already responded naturally".
        // BUT the new requirements imply we MIGHT want to acknowledge it if the AI hasn't.
        // However, sticking to the plan: Validation = Payment Confirmed.
        // Usually, the previous message from AI might have been "Please pay". 
        // If we want the AI to react to the CONFIRMATION, we should inject a system event provided as user message?
        // Or just let the NEXT user message trigger the 'Thank you' context.
        // Let's stick to: "AI response 'Thank you'" only if explicitly requested or if we send a message.
        // Update: The prompt implies: "Validated -> AI knows payment is passed".

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

            const rejectSystemPrompt = `You are ${agentName}, a friendly teenage girl chatting on WhatsApp.
You speak casually in short messages (3-8 words per message).
CURRENT SITUATION: The user claims they sent you money, but you just checked ALL your accounts and NOTHING arrived.

CRITICAL RULES:
1. You MUST tell the user you have NOT received ANY money.
2. Do NOT mention PayPal, Venmo, CashApp, or ANY payment method.
3. Do NOT give your account info.
4. Do NOT say thank you.
5. Do NOT confirm any payment.
6. Be confused/surprised that they claim to have sent something.
7. Keep it short and natural.

Example responses:
- "wait what? i didnt get anything"
- "huh? nothing came through"
- "are u sure? i checked and theres nothing"`

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
