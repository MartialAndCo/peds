/**
 * Payment Intent Classifier V2
 * Ultra-robust version with multiple checks and context analysis
 * Target: 95-98% accuracy
 */

import { venice } from '@/lib/venice';

export type PaymentIntent = 'VERIFICATION' | 'CONFIRMATION' | 'NONE';

interface ClassificationResult {
  intent: PaymentIntent;
  confidence: number;
  reason: string;
}

interface ConversationContext {
  hasPaymentMethodShared: boolean;
  hasUserClaimedToSend: boolean;
  hasUserAskedBefore: boolean;
  lastPaymentAmount?: string;
  lastPaymentMethod?: string;
}

/**
 * Analyze conversation history for payment context
 */
function analyzeContext(
  history: { role: 'user' | 'assistant'; content: string }[]
): ConversationContext {
  const ctx: ConversationContext = {
    hasPaymentMethodShared: false,
    hasUserClaimedToSend: false,
    hasUserAskedBefore: false
  };
  
  const fullText = history.map(m => m.content.toLowerCase()).join(' ');
  
  // Check if payment method was shared
  ctx.hasPaymentMethodShared = /paypal|venmo|cashapp|zelle|virement|banque|account|routing/.test(fullText);
  
  // Check if user claimed to send money
  ctx.hasUserClaimedToSend = /\b(sent|envoy|paid|payé|transferred|viré)\b/.test(fullText) && 
                             /\b(money|argent|payment|paiement|\$|€)\b/.test(fullText);
  
  // Check if user asked before
  ctx.hasUserAskedBefore = /\b(did you|have you|tu as|t'as|avez-vous)\b.*\b(receiv|reçu|check|get|got)\b/.test(fullText);
  
  // Extract last payment amount
  const amountMatch = fullText.match(/(\d+)\s*(\$|€|dollar|euro|bucks|k)/);
  if (amountMatch) {
    ctx.lastPaymentAmount = amountMatch[0];
  }
  
  return ctx;
}

/**
 * Pre-classify with regex for obvious cases (speed + consistency)
 */
function preClassify(
  message: string,
  ctx: ConversationContext
): { intent: PaymentIntent | null; reason: string } {
  const lower = message.toLowerCase().trim();
  
  // CONFIRMATION patterns - very strong signals
  const strongConfirmationPatterns = [
    /^sent[\s!]+/i,
    /^just sent\b/i,
    /^already sent\b/i,
    /^payment sent\b/i,
    /^money sent\b/i,
    /^(je viens d'|je viens de )/i,
    /^c'est fait\b/i,
    /^cest fait\b/i,
    /^done[\s!]+/i,
    /^transferred\b/i
  ];
  
  for (const pattern of strongConfirmationPatterns) {
    if (pattern.test(lower)) {
      // But check it's not a question
      if (!lower.includes('?') && !/\b(did|have|tu as|t'as|avez)\b/.test(lower)) {
        return { intent: 'CONFIRMATION', reason: 'Strong confirmation pattern at start' };
      }
    }
  }
  
  // VERIFICATION patterns - very strong signals
  // Must include payment-related words to avoid false positives like "did you receive my message?"
  const strongVerificationPatterns = [
    /^(did you|have you).*(receiv|get|got|check).*(money|payment|paypal|venmo|cash|argent|paiement)/i,
    /^(tu as|t'as|avez-vous).*(reçu|vu).*(argent|paiement|paypal)/i,
    /^check.*(paypal|venmo|account|payment|money)/i,
    /^(is it|did it).*(there|arriv|come through).*(money|payment|paypal)/i,
  ];
  
  for (const pattern of strongVerificationPatterns) {
    if (pattern.test(lower)) {
      return { intent: 'VERIFICATION', reason: 'Strong verification pattern' };
    }
  }
  
  // NONE patterns - definitely not payment
  const nonePatterns = [
    /^(how are|what's up|hey|hi|hello)\b/i,
    /check (this|the|my).*video|photo|image|song/i,
    /did you (see|watch|hear|read).*(news|video|movie|song)/i,
    /^(i will|i'll|je vais).*(send|envoy)/i, // Future = not confirmed
  ];
  
  for (const pattern of nonePatterns) {
    if (pattern.test(lower)) {
      return { intent: 'NONE', reason: 'Clear non-payment pattern' };
    }
  }
  
  return { intent: null, reason: 'Needs LLM classification' };
}

/**
 * Main classification function - multi-stage
 */
export async function classifyPaymentIntent(
  userMessage: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
  apiKey?: string
): Promise<ClassificationResult> {
  
  // Stage 1: Analyze context
  const ctx = analyzeContext(conversationHistory);
  
  // Stage 2: Fast pre-classification for obvious cases
  const preResult = preClassify(userMessage, ctx);
  if (preResult.intent && preResult.intent !== 'NONE') {
    // High confidence for strong patterns
    return {
      intent: preResult.intent,
      confidence: 0.95,
      reason: preResult.reason
    };
  }
  
  // Stage 3: LLM classification for ambiguous cases
  return llmClassify(userMessage, conversationHistory, ctx, apiKey);
}

/**
 * LLM-based classification with rich context
 */
async function llmClassify(
  userMessage: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  ctx: ConversationContext,
  apiKey?: string
): Promise<ClassificationResult> {
  
  const systemPrompt = `You are an expert payment intent classifier. You MUST analyze the CURRENT message within the FULL conversation context.

CONVERSATION CONTEXT ANALYSIS:
${ctx.hasPaymentMethodShared ? '- Payment method (PayPal/Venmo/etc.) was shared earlier' : '- No payment method discussed'}
${ctx.hasUserClaimedToSend ? '- User previously claimed to send money' : '- User has not mentioned sending money'}
${ctx.hasUserAskedBefore ? '- User has asked about receiving before' : '- First time asking'}
${ctx.lastPaymentAmount ? `- Payment amount mentioned: ${ctx.lastPaymentAmount}` : ''}

CLASSIFICATION RULES:

1. VERIFICATION (User asks if payment was received):
   - Short forms like "tu as reçu?" or "you got it?" are VERIFICATION if payment context exists
   - "did you check?" → VERIFICATION only if payment method was shared or user said they sent money
   - Pronouns ("it", "that") refer to payment if payment was discussed

2. CONFIRMATION (User confirms they sent money):
   - Must be past tense AND mention money/amount
   - NOT a question
   - Examples: "sent!", "just sent $50", "payment done", "je viens d'envoyer"

3. NONE (No payment intent):
   - Future promises: "I will send tomorrow"
   - Non-payment items: "check this video", "did you see the news?"
   - Generic questions without payment context

EDGE CASE HANDLING:
- "jai envoyé check ton paypal" → VERIFICATION (asking to check, despite "sent" being present)
- "I sent it, did you get it?" → VERIFICATION (question takes priority)
- "sent!" alone → CONFIRMATION only if payment context exists, else NONE
- "tu as reçu?" → VERIFICATION (French for "did you receive")

Respond with JSON:
{
  "intent": "VERIFICATION" | "CONFIRMATION" | "NONE",
  "confidence": 0.0-1.0,
  "reason": "detailed explanation using conversation context"
}`;

  // Build rich prompt with context
  const recentHistory = conversationHistory.slice(-5);
  let userPrompt: string;
  
  if (recentHistory.length > 0) {
    const historyText = recentHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    userPrompt = `CONVERSATION CONTEXT:\n${historyText}\n\n`;
    userPrompt += `CONTEXT SUMMARY:\n${ctx.hasPaymentMethodShared ? '- Payment method discussed\n' : ''}`;
    userPrompt += `${ctx.hasUserClaimedToSend ? '- User claimed to send money\n' : ''}`;
    userPrompt += `${ctx.lastPaymentAmount ? `- Amount: ${ctx.lastPaymentAmount}\n` : ''}`;
    userPrompt += `\nCURRENT MESSAGE: "${userMessage}"\n\nCLASSIFY considering the full context above.`;
  } else {
    userPrompt = `MESSAGE: "${userMessage}"\n\nCLASSIFY (no prior context):`;
  }

  try {
    const response = await venice.chatCompletion(
      systemPrompt,
      [],
      userPrompt,
      { 
        apiKey: apiKey || process.env.VENICE_API_KEY, 
        model: process.env.VENICE_MODEL || 'google-gemma-3-27b-it',
        temperature: 0.05 // Very low for consistency
      }
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { intent: 'NONE', confidence: 0, reason: 'Parse error' };
    }

    const result = JSON.parse(jsonMatch[0]) as ClassificationResult;
    
    // Validate
    if (!['VERIFICATION', 'CONFIRMATION', 'NONE'].includes(result.intent)) {
      return { intent: 'NONE', confidence: 0, reason: 'Invalid intent' };
    }

    console.log('[PaymentClassifierV2]', {
      message: userMessage.substring(0, 40),
      intent: result.intent,
      confidence: result.confidence,
      ctx: {
        method: ctx.hasPaymentMethodShared,
        claimed: ctx.hasUserClaimedToSend,
        asked: ctx.hasUserAskedBefore
      }
    });

    return result;

  } catch (error) {
    console.error('[PaymentClassifierV2] Error:', error);
    return { intent: 'NONE', confidence: 0, reason: 'Classification error' };
  }
}

/**
 * Batch test function
 */
export async function batchClassify(
  messages: { text: string; expected: PaymentIntent; context?: any[] }[],
  apiKey?: string
): Promise<{ passed: number; failed: number; results: any[] }> {
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (const test of messages) {
    const result = await classifyPaymentIntent(test.text, test.context as any, apiKey);
    const match = result.intent === test.expected;
    
    if (match) passed++;
    else failed++;
    
    results.push({
      text: test.text,
      expected: test.expected,
      got: result.intent,
      match,
      confidence: result.confidence,
      reason: result.reason
    });
    
    await new Promise(r => setTimeout(r, 150));
  }
  
  return { passed, failed, results };
}
