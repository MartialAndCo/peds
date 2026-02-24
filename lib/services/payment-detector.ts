import { venice } from '@/lib/venice'
import { settingsService } from '@/lib/settings-cache'
import { logger } from '@/lib/logger'

export interface PaymentClaimResult {
    claimed: boolean
    amount?: number
    method?: string
    confidence: number // 0-1
}

/**
 * Detect if a user message contains a payment claim.
 * Uses AI to analyze the message and extract amount/method if present.
 * 
 * @param message - The user's message to analyze
 * @param settings - Optional settings (API keys, etc.)
 * @param conversationHistory - Optional conversation history for context (last N messages)
 */
export async function detectPaymentClaim(
    message: string,
    settings?: any,
    conversationHistory?: Array<{ role: 'user' | 'ai', content: string }>
): Promise<PaymentClaimResult> {

    // Quick keyword pre-filter to avoid AI calls on unrelated messages
    const paymentKeywords = [
        'paid', 'sent', 'transferred', 'envoyé', 'payé', 'viré', 'envoi',
        'payment', 'paiement', 'money', 'argent', 'cash', 'dollars', 'euros',
        'paypal', 'venmo', 'cashapp', 'zelle', 'crypto', 'bitcoin', 'btc',
        'done', 'c\'est fait', 'c\'est bon', 'voilà', 'here you go', 'just sent',
        'account', 'funds', 'check your'
        // REMOVED: 'fait' alone (too generic, triggers on "fais-le", "fait tout de suite")
        // REMOVED: 'check' alone (triggers on "check this out")
        // REMOVED: 'care' (triggers on "take care")
    ]

    const lowerMsg = message.toLowerCase()
    const hasKeyword = paymentKeywords.some(kw => lowerMsg.includes(kw))

    // NEGATIVE PATTERNS: Reject messages that are clearly NOT payment claims
    // These are commands, threats, or unrelated uses of payment keywords
    const negativePatterns = [
        /fait.*(tout de suite|vite|maintenant)/i,    // "Fait tout de suite" = command, not claim
        /fais[- ]le/i,                               // "Fais-le" = command
        /sinon.*bloqu/i,                             // Threats to block
        /(envoie|envoi).*(photo|video|image)/i,     // Request for media
        /check (this|it|my message|out)/i,          // Unrelated "check"
        /take care/i,                                // Greeting
        /i don'?t care/i,                            // Unrelated
    ]

    const isNegativePattern = negativePatterns.some(pattern => pattern.test(message))

    if (isNegativePattern) {
        logger.info('Payment detection skipped (Negative pattern match)', {
            module: 'payment-detector',
            message: message.substring(0, 50)
        })
        return { claimed: false, confidence: 0 }
    }

    if (!hasKeyword) {
        return { claimed: false, confidence: 0 }
    }

    // AI Analysis
    const s = settings || await settingsService.getSettings()

    const systemPrompt = `You are a payment claim detector. Analyze the user's message and determine if they are claiming to have made a payment/sent money.
    
    CRITICAL: You must extract the EXACT numeric amount if possible.
    - "100$" -> 100
    - "97 000 $" -> 97000
    - "50 bucks" -> 50
    - "2k" -> 2000
    - "54" -> 54
    
    HANDLE SLANG & IMPLICIT (English/US):
    - "It's done" -> Claimed: true
    - "Sent you 50 bucks" -> Claimed: true, Amount: 50
    - "Check your paypal" -> Claimed: true
    - "I put it in your account" -> Claimed: true
    - "Just took care of it" -> Claimed: true
    - "Funds sent" -> Claimed: true
    - "You should see it now" -> Claimed: true

    REJECT FALSE POSITIVES (Critical):
    - Future tense: "I will pay you", "I'm going to send it" -> Claimed: false
    - Questions: "Did you get it?", "How do I pay?" -> Claimed: false
    - Unrelated "Check": "Check this out", "Can you check my message?" -> Claimed: false
    - Unrelated "Care": "Take care", "I don't care" -> Claimed: false
    - Conditionals: "I would send it if..." -> Claimed: false
    
Output ONLY valid JSON:
{
    "claimed": boolean,  // true if user claims the action is COMPLETED
    "amount": number | null,  // extracted amount if mentioned (just the number)
    "method": string | null,  // payment method if mentioned
    "confidence": number  // 0.0 to 1.0
}

Examples:
- "I just sent you 50 on PayPal" -> {"claimed": true, "amount": 50, "method": "PayPal", "confidence": 0.95}
- "sent 100" -> {"claimed": true, "amount": 100, "method": null, "confidence": 0.9}
- "payment done!" -> {"claimed": true, "amount": null, "method": null, "confidence": 0.8}
- "here is 97 000 $" -> {"claimed": true, "amount": 97000, "method": null, "confidence": 0.95}
- "it's in your venice bank" -> {"claimed": true, "amount": null, "method": "Bank Transfer", "confidence": 0.85}
- "check your account, sent 20" -> {"claimed": true, "amount": 20, "method": "Bank Transfer", "confidence": 0.9}
- "how do I pay you?" -> {"claimed": false, "confidence": 1.0}
- "I'll pay you tomorrow" -> {"claimed": false, "confidence": 1.0}
- "Take care!" -> {"claimed": false, "confidence": 1.0}`

    try {
        // Build context message with history if available
        let userMessage = `Analyze this message: "${message}"`

        // If conversation history is provided and message is implicit (no method/amount mentioned),
        // instruct AI to look back at conversation for payment method
        if (conversationHistory && conversationHistory.length > 0) {
            const hasMethod = /paypal|venmo|cashapp|zelle|crypto|bitcoin|bank|transfer|virement/i.test(message)
            const hasAmount = /\d+/.test(message)

            if (!hasMethod || !hasAmount) {
                userMessage += `\n\nCONTEXT: The user's message may be implicit (e.g., "c'est fait", "envoyé", "done"). Look at the conversation history below to find:
1. What payment method was discussed or requested (PayPal, bank transfer, etc.)
2. What amount was mentioned or agreed upon

If the current message is a payment claim but lacks details, extract them from the conversation history.

CONVERSATION HISTORY (most recent last):
${conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')}

Now analyze the user's latest message: "${message}"`
            }
        }

        const response = await venice.chatCompletion(
            systemPrompt,
            [],
            userMessage,
            {
                apiKey: s.venice_api_key,
                model: s.venice_model || 'google-gemma-3-27b-it',
                max_tokens: 150
            }
        )

        // Parse JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            logger.info('Payment claim detection result', { module: 'payment-detector', result: parsed })
            return {
                claimed: parsed.claimed === true,
                amount: parsed.amount ? Number(parsed.amount) : undefined,
                method: parsed.method || undefined,
                confidence: parsed.confidence || 0.5
            }
        }
    } catch (e) {
        logger.error('Payment detection failed', e as Error, { module: 'payment-detector' })
    }

    return { claimed: false, confidence: 0 }
}
