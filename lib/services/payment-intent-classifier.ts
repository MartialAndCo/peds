/**
 * Payment Intent Classifier
 * Uses LLM (Venice) to intelligently classify payment-related messages
 * Much more robust than regex/keyword matching
 */

import { venice } from '@/lib/venice';

export type PaymentIntent = 'VERIFICATION' | 'CONFIRMATION' | 'NONE';

interface ClassificationResult {
  intent: PaymentIntent;
  confidence: number;
  reason: string;
}

/**
 * Classify user message to determine payment intent
 * Uses Venice LLM for contextual understanding
 */
export async function classifyPaymentIntent(
  userMessage: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
  apiKey?: string
): Promise<ClassificationResult> {
  
  const systemPrompt = `You are a payment intent classifier. Analyze the user's message and classify it into one of three categories:

CATEGORIES:
1. VERIFICATION - User is ASKING if a payment was received (checking status)
   Examples: "did you get it?", "tu as reçu?", "did you check paypal?", "is the money there?"
   Key: Question about receiving/checking + payment context

2. CONFIRMATION - User is CONFIRMING they already sent money (action completed)
   Examples: "I sent $50", "just transferred", "payment done", "je viens d'envoyer"
   Key: Past tense action + money sent + NOT a question

3. NONE - No payment context at all
   Examples: "how are you?", "check this video", "did you see my message?"

CRITICAL RULES:
- "did you check?" alone = NONE (no payment context)
- "did you check paypal?" = VERIFICATION (payment context)
- "I sent it" + "did you get it?" = VERIFICATION (question takes priority)
- "just sent $100" = CONFIRMATION (past action, no question)
- "I will send tomorrow" = NONE (future, not confirmed)

Respond ONLY with JSON format:
{
  "intent": "VERIFICATION" | "CONFIRMATION" | "NONE",
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}`;

  // Build context from recent history (last 3 messages)
  const recentHistory = conversationHistory.slice(-3);
  const historyContext = recentHistory.length > 0 
    ? `Recent conversation:\n${recentHistory.map(m => `${m.role}: ${m.content}`).join('\n')}\n\n`
    : '';

  const userPrompt = `${historyContext}Classify this message: "${userMessage}"`;

  try {
    const response = await venice.chatCompletion(
      systemPrompt,
      [],
      userPrompt,
      { 
        apiKey: apiKey || process.env.VENICE_API_KEY, 
        model: process.env.VENICE_MODEL || 'venice-uncensored',
        temperature: 0.1 // Low temp for consistent classification
      }
    );

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[PaymentClassifier] No JSON found in response:', response);
      return { intent: 'NONE', confidence: 0, reason: 'Parse error' };
    }

    const result = JSON.parse(jsonMatch[0]) as ClassificationResult;
    
    // Validate result
    if (!['VERIFICATION', 'CONFIRMATION', 'NONE'].includes(result.intent)) {
      console.warn('[PaymentClassifier] Invalid intent:', result.intent);
      return { intent: 'NONE', confidence: 0, reason: 'Invalid intent' };
    }

    console.log('[PaymentClassifier]', {
      message: userMessage.substring(0, 50),
      intent: result.intent,
      confidence: result.confidence,
      reason: result.reason
    });

    return result;

  } catch (error) {
    console.error('[PaymentClassifier] Error:', error);
    // Fallback to NONE on error (safe default)
    return { intent: 'NONE', confidence: 0, reason: 'Classification error' };
  }
}

/**
 * Batch classify multiple messages (for testing)
 */
export async function batchClassify(
  messages: string[],
  apiKey?: string
): Promise<{ message: string; result: ClassificationResult }[]> {
  const results = [];
  
  for (const message of messages) {
    const result = await classifyPaymentIntent(message, [], apiKey);
    results.push({ message, result });
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }
  
  return results;
}
