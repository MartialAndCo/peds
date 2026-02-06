/**
 * Test Payment Intent Classifier
 * Tests LLM-based classification vs regex approach
 */

import { classifyPaymentIntent, batchClassify } from '@/lib/services/payment-intent-classifier';

const TEST_CASES = [
  // === CONFIRMATION ===
  { msg: 'I sent you $50', expected: 'CONFIRMATION' },
  { msg: 'just sent 100 on paypal', expected: 'CONFIRMATION' },
  { msg: 'je viens de t\'envoyer 200€', expected: 'CONFIRMATION' },
  { msg: 'payment done', expected: 'CONFIRMATION' },
  { msg: 'transferred the money', expected: 'CONFIRMATION' },
  { msg: 'Le paiement a été effectué', expected: 'CONFIRMATION' },
  { msg: 'sent 500 bucks!', expected: 'CONFIRMATION' },
  
  // === VERIFICATION ===
  { msg: 'did you check?', expected: 'NONE' }, // Sans contexte argent
  { msg: 'did you check paypal?', expected: 'VERIFICATION' },
  { msg: 'did you receive the money?', expected: 'VERIFICATION' },
  { msg: 'tu as reçu?', expected: 'NONE' }, // Sans contexte
  { msg: 'tu as reçu l\'argent?', expected: 'VERIFICATION' },
  { msg: 'check your paypal', expected: 'VERIFICATION' },
  { msg: 'you got it?', expected: 'NONE' }, // Trop ambigu
  { msg: 'did you see it?', expected: 'NONE' }, // Ambigu sans contexte
  
  // === NONE (faux positifs) ===
  { msg: 'how are you today?', expected: 'NONE' },
  { msg: 'check this video I sent you', expected: 'NONE' },
  { msg: 'did you receive my last message?', expected: 'NONE' },
  { msg: 'I need money for rent', expected: 'NONE' },
  { msg: 'I will send you money tomorrow', expected: 'NONE' },
  { msg: 'do you have paypal?', expected: 'NONE' },
  { msg: 'let me check my account first', expected: 'NONE' },
  { msg: 'did you see the news?', expected: 'NONE' },
  
  // === Edge cases ===
  { msg: 'did you check?', context: [{role: 'assistant', content: 'my paypal is lena9200'}, {role: 'user', content: 'I sent you money'}], expected: 'VERIFICATION' },
  { msg: 'jai envoyé check ton paypal', expected: 'VERIFICATION' }, // Mix
  { msg: 'I sent it, did you get it?', expected: 'VERIFICATION' }, // Question prioritaire
];

async function runTests() {
  console.log('='.repeat(80));
  console.log('PAYMENT INTENT CLASSIFIER TESTS (LLM-based)');
  console.log('='.repeat(80));
  
  let passed = 0;
  let failed = 0;
  
  for (const test of TEST_CASES) {
    try {
      console.log(`\n🧪 "${test.msg}"`);
      if (test.context) {
        console.log(`   Context: ${test.context.map(c => c.content.substring(0, 30)).join(' | ')}`);
      }
      
      const result = await classifyPaymentIntent(test.msg, test.context);
      
      const match = result.intent === test.expected;
      
      if (match) {
        console.log(`   ✅ ${result.intent} (confidence: ${result.confidence.toFixed(2)})`);
        console.log(`   Reason: ${result.reason}`);
        passed++;
      } else {
        console.log(`   ❌ Expected ${test.expected}, got ${result.intent}`);
        console.log(`   Reason: ${result.reason}`);
        failed++;
      }
      
      // Small delay
      await new Promise(r => setTimeout(r, 200));
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${TEST_CASES.length}`);
  console.log('='.repeat(80));
}

runTests().catch(console.error);
