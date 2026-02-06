/**
 * Payment Intent Classifier
 * Pure LLM approach - uses conversation context only
 */

import { venice } from '@/lib/venice';

export type PaymentIntent = 'VERIFICATION' | 'CONFIRMATION' | 'NONE';

interface ClassificationResult {
  intent: PaymentIntent;
  confidence: number;
  reason: string;
}

/**
 * Classify payment intent using conversation context
 * No regex, just LLM understanding
 */
export async function classifyPaymentIntent(
  userMessage: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
  apiKey?: string
): Promise<ClassificationResult> {
  
  const systemPrompt = `You are a payment intent classifier. Your ONLY job is to analyze the LAST message in the context of the conversation history.

CONVERSATION HISTORY:
${conversationHistory.length === 0 ? '[NO PREVIOUS MESSAGES - THIS IS THE START OF CONVERSATION]' : conversationHistory.slice(-5).map((m, i) => `${i + 1}. ${m.role}: "${m.content}"`).join('\n')}

TASK:
Read the conversation above, then classify the LAST user message into one of three categories:

1. CONFIRMATION - User confirms they ALREADY sent money
   - Past tense action completed
   - Examples: "sent!", "just sent $50", "payment done", "je viens d'envoyer"
   - NOT a question

2. VERIFICATION - User asks if payment was received  
   - Asking about status/checking
   - Examples: "did you get it?", "tu as reçu?", "check your paypal"
   - Question about receiving

3. NONE - No payment intent
   - Future promises ("I will send tomorrow")
   - Non-payment items ("check this video")
   - Generic questions without payment context

CRITICAL RULES:
- NO CONVERSATION HISTORY = NO PAYMENT CONTEXT
- If the conversation history is EMPTY or doesn't mention payment, the answer is ALWAYS NONE
- "did you check?" with NO history = NONE (cannot assume it's about payment)
- "sent!" with NO history = NONE (could be "I sent a message", "I sent a photo", etc.)
- ONLY classify as VERIFICATION/CONFIRMATION if payment was actually discussed in history
- When uncertain, ALWAYS choose NONE

Respond with JSON:
{
  "intent": "VERIFICATION" | "CONFIRMATION" | "NONE",
  "confidence": 0.0-1.0,
  "reason": "explain using conversation context"
}`;

  try {
    const response = await venice.chatCompletion(
      systemPrompt,
      [],
      `LAST MESSAGE TO CLASSIFY: "${userMessage}"`,
      { 
        apiKey: apiKey || process.env.VENICE_API_KEY, 
        model: process.env.VENICE_MODEL || 'venice-uncensored',
        temperature: 0.1
      }
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { intent: 'NONE', confidence: 0, reason: 'Parse error' };
    }

    const result = JSON.parse(jsonMatch[0]) as ClassificationResult;
    
    if (!['VERIFICATION', 'CONFIRMATION', 'NONE'].includes(result.intent)) {
      return { intent: 'NONE', confidence: 0, reason: 'Invalid' };
    }

    return result;

  } catch (error) {
    console.error('[Classifier] Error:', error);
    return { intent: 'NONE', confidence: 0, reason: 'Error' };
  }
}

export async function batchClassify(
  tests: { msg: string; ctx: any[]; expected: PaymentIntent }[],
  apiKey?: string
): Promise<any> {
  const results = [];
  let passed = 0;
  
  for (const test of tests) {
    const result = await classifyPaymentIntent(test.msg, test.ctx, apiKey);
    const match = result.intent === test.expected;
    if (match) passed++;
    
    results.push({
      msg: test.msg,
      expected: test.expected,
      got: result.intent,
      match,
      reason: result.reason
    });
    
    await new Promise(r => setTimeout(r, 100));
  }
  
  return { passed, total: tests.length, results };
}
