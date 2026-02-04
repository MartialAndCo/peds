// Response formatter - Enforce brevity and format rules
// Use this as a fallback if LLM doesn't respect style rules

export function formatResponse(text: string): string {
    // Remove bold
    let formatted = text.replace(/\*\*/g, '');

    // Remove brackets (except [VOICE], [PAYMENT_RECEIVED], [PAIEMENT_REÇU], [PAIEMENT_RECU])
    formatted = formatted.replace(/\[(?!VOICE|PAYMENT_RECEIVED|PAIEMENT_REÇU|PAIEMENT_RECU)([^\]]+)\]/g, '$1');

    // Remove image tags
    formatted = formatted.replace(/\[IMAGE:[^\]]+\]/g, '');

    // Clean up excessive newlines
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    // Remove roboticformat "paypal: xxx" -> "xxx"
    formatted = formatted.replace(/paypal:\s*/gi, '');
    formatted = formatted.replace(/venmo:\s*/gi, '');
    formatted = formatted.replace(/cashapp:\s*/gi, '');

    return formatted.trim();
}

export function checkMessageLength(text: string): {
    isValid: boolean;
    wordCount: number;
    suggestion: string
} {
    // Remove tags for counting
    const cleanText = text
        .replace(/\[VOICE\]/g, '')
        .replace(/\[PAYMENT_RECEIVED\]|\[PAIEMENT_REÇU\]|\[PAIEMENT_RECU\]/g, '')
        .replace(/\*\*/g, '');

    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    if (wordCount <= 8) {
        return { isValid: true, wordCount, suggestion: '' };
    }

    // Suggest using separator
    const suggestion = `Message too long (${wordCount} words). Consider splitting with | or shortening.`;

    return { isValid: false, wordCount, suggestion };
}

export function shouldUsePaymentTag(userMessage: string): boolean {
    const lowerMsg = userMessage.toLowerCase();

    // Past tense indicators
    const pastTense = [
        'sent',
        'done',
        'transferred',
        'sent it',
        'just sent',
        "it's done"
    ];

    return pastTense.some(phrase => lowerMsg.includes(phrase));
}
