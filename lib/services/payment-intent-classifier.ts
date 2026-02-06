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
  
  const systemPrompt = `You are a payment intent classifier. Your task is to analyze the user's CURRENT message in the context of the conversation history.

CATEGORIES:
1. VERIFICATION - User is ASKING if a payment was received (checking status)
   Examples: "did you get it?", "tu as reçu?", "did you check paypal?", "is the money there?"
   Key: Question about receiving/checking + payment context

2. CONFIRMATION - User is CONFIRMING they already sent money (action completed)
   Examples: "I sent $50", "just transferred", "payment done", "je viens d'envoyer"
   Key: Past tense action + money sent + NOT a question

3. NONE - No payment context at all
   Examples: "how are you?", "check this video", "did you see my message?"

HOW TO USE CONTEXT:
- The conversation history is CRUCIAL for understanding short/ambiguous messages
- If previous messages discussed payment, pronouns like "it" refer to that payment
- "did you check?" with NO payment context = NONE
- "did you check?" with payment context = VERIFICATION
- Always infer the user's intent from the FULL conversation

EXAMPLES WITH CONTEXT:
Context: Assistant gave PayPal account → User: "did you check?" → VERIFICATION (asking about payment)
Context: General chat → User: "did you check?" → NONE (could mean anything)
Context: User said "I sent money" → User: "did you get it?" → VERIFICATION (checking if received)
Context: None → User: "sent!" → NONE (no payment context)
Context: PayPal shared → User: "sent!" → CONFIRMATION (referring to PayPal payment)

Respond ONLY with JSON format:
{
  "intent": "VERIFICATION" | "CONFIRMATION" | "NONE",
  "confidence": 0.0-1.0,
  "reason": "brief explanation referencing context"
}`;

  // Build context from recent history (last 5 messages for better context)
  const recentHistory = conversationHistory.slice(-5);
  
  let userPrompt: string;
  
  if (recentHistory.length > 0) {
    const historyText = recentHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    userPrompt = `CONVERSATION HISTORY (use this to understand the context):\n${historyText}\n\nCURRENT MESSAGE TO CLASSIFY:\n"${userMessage}"\n\nBased on the full conversation, what is the intent of the CURRENT message?`;
  } else {
    userPrompt = `CURRENT MESSAGE TO CLASSIFY:\n"${userMessage}"\n\nWhat is the intent of this message?`;
  }

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
