/**
 * Payment Integration Tests
 * Tests complete flow: message → AI response → tag detection → notification
 */

import { venice } from '@/lib/venice';
import { prisma } from '@/lib/prisma';

// Test configuration
const TEST_CONFIG = {
  apiKey: process.env.VENICE_API_KEY,
  model: 'venice-uncensored'
};

// Test conversations with history context
const INTEGRATION_TESTS = [
  {
    name: 'Full Flow: Direct Payment Confirmation',
    history: [
      { role: 'user', content: 'hey how much do you need?' },
      { role: 'assistant', content: 'hey! just 50 for groceries 🥺' },
      { role: 'user', content: 'sure sending now' }
    ],
    newMessage: 'sent! check your paypal',
    expectedBehavior: {
      shouldContainTag: '[PAYMENT_RECEIVED]',
      shouldNotContainTag: '[VERIFY_PAYMENT]',
      tone: 'grateful and surprised'
    }
  },
  {
    name: 'Full Flow: Verification Request',
    history: [
      { role: 'user', content: 'hey I sent you money yesterday' },
      { role: 'assistant', content: 'really? let me check!' },
      { role: 'user', content: 'did you check?' }
    ],
    newMessage: 'did you check?',
    expectedBehavior: {
      shouldContainTag: '[VERIFY_PAYMENT]',
      shouldNotContainTag: '[PAYMENT_RECEIVED]',
      tone: 'checking, not confirming'
    }
  },
  {
    name: 'Edge Case: Ambiguous "check" (not payment)',
    history: [
      { role: 'user', content: 'check this song I just made' }
    ],
    newMessage: 'did you check the song?',
    expectedBehavior: {
      shouldNotContainTag: '[VERIFY_PAYMENT]',
      shouldNotContainTag: '[PAYMENT_RECEIVED]',
      context: 'music not payment'
    }
  },
  {
    name: 'Edge Case: "Sent" but referring to message',
    history: [
      { role: 'user', content: 'I sent you the photo earlier' }
    ],
    newMessage: 'did you see it?',
    expectedBehavior: {
      shouldNotContainTag: '[PAYMENT_RECEIVED]',
      context: 'photo not money'
    }
  },
  {
    name: 'Stress Test: Repeated verification',
    history: [
      { role: 'user', content: 'sent you 100' },
      { role: 'assistant', content: 'omg tysm! [PAYMENT_RECEIVED]' },
      { role: 'user', content: 'did you get it?' },
      { role: 'assistant', content: 'yes got it! thanks!' },
      { role: 'user', content: 'are you sure?' }
    ],
    newMessage: 'are you sure you got it?',
    expectedBehavior: {
      shouldContainTag: '[VERIFY_PAYMENT]',
      note: 'User asking again, should trigger verification'
    }
  },
  {
    name: 'Stress Test: Large amount',
    history: [
      { role: 'user', content: 'I can help with your situation' }
    ],
    newMessage: 'just transferred 5000 to your account',
    expectedBehavior: {
      shouldContainTag: '[PAYMENT_RECEIVED]',
      tone: 'very grateful, large amount'
    }
  },
  {
    name: 'Language Test: French confirmation',
    history: [
      { role: 'user', content: 'salut ça va?' },
      { role: 'assistant', content: 'ça va et toi?' }
    ],
    newMessage: 'je viens de t\'envoyer 100€',
    expectedBehavior: {
      shouldContainTag: '[PAIEMENT_REÇU]',
      language: 'french'
    }
  },
  {
    name: 'Language Test: French verification',
    history: [
      { role: 'user', content: 'j\'ai fait le virement hier' }
    ],
    newMessage: 'tu as reçu?',
    expectedBehavior: {
      shouldContainTag: '[VERIFIER_PAIEMENT]',
      language: 'french'
    }
  },
  {
    name: 'Edge Case: Future promise',
    history: [
      { role: 'user', content: 'I want to help you' }
    ],
    newMessage: 'I will send you money tomorrow',
    expectedBehavior: {
      shouldNotContainTag: '[PAYMENT_RECEIVED]',
      shouldNotContainTag: '[VERIFY_PAYMENT]',
      note: 'Future tense, no confirmation yet'
    }
  },
  {
    name: 'Edge Case: Question about method',
    history: [
      { role: 'assistant', content: 'I need some help 🥺' }
    ],
    newMessage: 'do you have paypal?',
    expectedBehavior: {
      shouldNotContainTag: '[PAYMENT_RECEIVED]',
      shouldNotContainTag: '[VERIFY_PAYMENT]',
      note: 'Just asking for payment method'
    }
  }
];

async function runIntegrationTest(test: typeof INTEGRATION_TESTS[0]) {
  console.log(`\n🧪 ${test.name}`);
  console.log(`   Input: "${test.newMessage}"`);
  
  try {
    // Build system prompt similar to payment-node
    const isFrench = /[àâäéèêëïîôùûüç]/i.test(test.newMessage);
    
    const systemPrompt = `You are Lena, a friendly ${isFrench ? 'French' : ''} teenage girl chatting.
You speak casually in short messages (3-10 words).

PAYMENT RULES:
${isFrench ? `
- Si l'utilisateur confirme avoir envoyé → utilise [PAIEMENT_REÇU]
- Si l'utilisateur demande si tu as reçu → utilise [VERIFIER_PAIEMENT]
- Si ce n'est pas un paiement → pas de tag
` : `
- If user confirms they sent money → use [PAYMENT_RECEIVED]
- If user asks if you received → use [VERIFY_PAYMENT]
- If not about payment → no tag
`}

Be natural, use emojis, vary your responses.`;

    // Call Venice
    const response = await venice.chatCompletion(
      systemPrompt,
      test.history,
      test.newMessage,
      { apiKey: TEST_CONFIG.apiKey, model: TEST_CONFIG.model, temperature: 0.8 }
    );
    
    console.log(`   AI Response: "${response}"`);
    
    // Check expectations
    let passed = true;
    const checks: string[] = [];
    
    if (test.expectedBehavior.shouldContainTag) {
      if (response.includes(test.expectedBehavior.shouldContainTag)) {
        checks.push(`✅ Contains ${test.expectedBehavior.shouldContainTag}`);
      } else {
        checks.push(`❌ Missing ${test.expectedBehavior.shouldContainTag}`);
        passed = false;
      }
    }
    
    if (test.expectedBehavior.shouldNotContainTag) {
      if (!response.includes(test.expectedBehavior.shouldNotContainTag)) {
        checks.push(`✅ Does not contain ${test.expectedBehavior.shouldNotContainTag}`);
      } else {
        checks.push(`❌ Should not contain ${test.expectedBehavior.shouldNotContainTag}`);
        passed = false;
      }
    }
    
    // Check for wrong tag combinations
    if (response.includes('[PAYMENT_RECEIVED]') && response.includes('[VERIFY_PAYMENT]')) {
      checks.push(`❌ Contains BOTH tags - should only have one`);
      passed = false;
    }
    
    checks.forEach(c => console.log(`   ${c}`));
    
    if (test.expectedBehavior.note) {
      console.log(`   📝 Note: ${test.expectedBehavior.note}`);
    }
    
    return passed;
    
  } catch (error) {
    console.log(`   ❌ ERROR: ${error}`);
    return false;
  }
}

async function runAllTests() {
  console.log('='.repeat(80));
  console.log('PAYMENT INTEGRATION TESTS (Live AI Calls)');
  console.log('='.repeat(80));
  console.log(`Using model: ${TEST_CONFIG.model}`);
  console.log(`API Key: ${TEST_CONFIG.apiKey ? '✅ Present' : '❌ Missing'}`);
  
  if (!TEST_CONFIG.apiKey) {
    console.log('\n❌ Cannot run tests without VENICE_API_KEY');
    process.exit(1);
  }
  
  let passed = 0;
  let failed = 0;
  
  for (const test of INTEGRATION_TESTS) {
    const result = await runIntegrationTest(test);
    if (result) passed++;
    else failed++;
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${INTEGRATION_TESTS.length}`);
  console.log('='.repeat(80));
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { INTEGRATION_TESTS };
