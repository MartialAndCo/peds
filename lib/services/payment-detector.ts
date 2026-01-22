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
 */
export async function detectPaymentClaim(
    message: string,
    settings?: any
): Promise<PaymentClaimResult> {

    // Quick keyword pre-filter to avoid AI calls on unrelated messages
    const paymentKeywords = [
        'paid', 'sent', 'transferred', 'envoyé', 'payé', 'viré', 'envoi',
        'payment', 'paiement', 'money', 'argent', 'cash', 'dollars', 'euros',
        'paypal', 'venmo', 'cashapp', 'zelle', 'crypto', 'bitcoin', 'btc',
        'done', 'fait', 'c\'est bon', 'voilà', 'here you go', 'just sent'
    ]

    const lowerMsg = message.toLowerCase()
    const hasKeyword = paymentKeywords.some(kw => lowerMsg.includes(kw))

    if (!hasKeyword) {
        return { claimed: false, confidence: 0 }
    }

    // AI Analysis
    const systemPrompt = `You are a payment claim detector. Analyze the user's message and determine if they are claiming to have made a payment/sent money.
    
    CRITICAL: You must extract the EXACT numeric amount if possible.
    - "100$" -> 100
    - "97 000 $" -> 97000
    - "50 euros" -> 50
    - "2 barres" -> 20 (slang for 20?) OR if they mean 2 million/200 depends on context, usually 1 barre = 100 or 1000? Context: "2 barres" in french street slang is often 200€ or 2000€. If unsure, extract raw number 2. (Actually "1 barre" = 100€ usually, "1 brique" = 10k or 100 old francs... stick to explicit numbers if possible, or best guess).
    - "54" -> 54
    
    HANDLE SLANG & IMPLICIT (French/English):
    - "C'est fait" (It's done) -> Claimed: true
    - "Je t'ai envoyé les 50 balles" -> Claimed: true, Amount: 50
    - "Check ton paypal" -> Claimed: true
    
Output ONLY valid JSON:
{
    "claimed": boolean,  // true if user says they paid/sent money
    "amount": number | null,  // extracted amount if mentioned (just the number)
    "method": string | null,  // payment method if mentioned (PayPal, Venmo, CashApp, Zelle, Crypto, Bank Transfer, etc.)
    "confidence": number  // 0.0 to 1.0, how confident you are
}

Examples:
- "I just sent you 50 on PayPal" -> {"claimed": true, "amount": 50, "method": "PayPal", "confidence": 0.95}
- "j'ai envoyé 100€" -> {"claimed": true, "amount": 100, "method": null, "confidence": 0.9}
- "payment done!" -> {"claimed": true, "amount": null, "method": null, "confidence": 0.8}
- "here is 97 000 $" -> {"claimed": true, "amount": 97000, "method": null, "confidence": 0.95}
- "je t'ai envoyé 2 barres" -> {"claimed": true, "amount": 200, "method": null, "confidence": 0.85} (Assuming 1 barre = 100)
- "c'est envoyé" -> {"claimed": true, "amount": null, "method": null, "confidence": 0.9}
- "how do I pay you?" -> {"claimed": false, "amount": null, "method": null, "confidence": 0.95}`

    try {
        const response = await venice.chatCompletion(
            systemPrompt,
            [],
            `Analyze this message: "${message}"`,
            {
                apiKey: s.venice_api_key,
                model: s.venice_model || 'venice-uncensored',
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
