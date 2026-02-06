import { classifyPaymentIntent, batchClassify } from '@/lib/services/payment-intent-classifier-v2';

// Tests complets avec contexte
const TESTS = [
  // === CONFIRMATION (doivent être 100% sûrs) ===
  { text: 'sent!', expected: 'CONFIRMATION', context: [{role: 'assistant', content: 'paypal: lena9200'}] },
  { text: 'just sent $50', expected: 'CONFIRMATION' },
  { text: 'payment done', expected: 'CONFIRMATION' },
  { text: 'transferred the money', expected: 'CONFIRMATION' },
  { text: 'je viens de tenvoyer 200', expected: 'CONFIRMATION' },
  { text: 'Le paiement a été effectué', expected: 'CONFIRMATION' },
  { text: 'sent 500 bucks!', expected: 'CONFIRMATION' },
  
  // === VERIFICATION (avec contexte) ===
  { text: 'did you check?', expected: 'VERIFICATION', context: [
    {role: 'assistant', content: 'my paypal is lena9200'},
    {role: 'user', content: 'I sent money'}
  ]},
  { text: 'did you receive?', expected: 'VERIFICATION', context: [
    {role: 'user', content: 'I transferred $100'}
  ]},
  { text: 'tu as reçu?', expected: 'VERIFICATION', context: [
    {role: 'assistant', content: 'voici mon paypal'},
    {role: 'user', content: 'jai envoyé'}
  ]},
  { text: 'check your paypal', expected: 'VERIFICATION', context: [
    {role: 'user', content: 'sent you money'}
  ]},
  { text: 'you got it?', expected: 'VERIFICATION', context: [
    {role: 'user', content: 'just sent $50'}
  ]},
  { text: 'did you see it?', expected: 'VERIFICATION', context: [
    {role: 'user', content: 'transferred the payment'}
  ]},
  
  // === NONE (cas clairs) ===
  { text: 'how are you?', expected: 'NONE' },
  { text: 'check this video', expected: 'NONE' },
  { text: 'did you see the news?', expected: 'NONE' },
  { text: 'I need money for rent', expected: 'NONE' },
  { text: 'I will send tomorrow', expected: 'NONE' },
  { text: 'do you have paypal?', expected: 'NONE' },
  { text: 'let me check my account', expected: 'NONE' },
  { text: 'did you receive my message?', expected: 'NONE' },
  
  // === Edge cases ===
  { text: 'jai envoyé check ton paypal', expected: 'VERIFICATION' },
  { text: 'I sent it, did you get it?', expected: 'VERIFICATION' },
  { text: 'sent! did you see it?', expected: 'VERIFICATION' },
  { text: 'did you check?', expected: 'NONE' }, // Sans contexte
  { text: 'you got it?', expected: 'NONE' }, // Sans contexte
];

async function run() {
  console.log('='.repeat(80));
  console.log('PAYMENT CLASSIFIER V2 - TARGET: 95%+ ACCURACY');
  console.log('='.repeat(80));
  
  const result = await batchClassify(TESTS);
  
  console.log(`\nResults: ${result.passed}/${TESTS.length} (${((result.passed/TESTS.length)*100).toFixed(1)}%)`);
  
  if (result.failed > 0) {
    console.log('\n❌ FAILURES:');
    result.results.filter(r => !r.match).forEach(r => {
      console.log(`  "${r.text}"`);
      console.log(`    Expected: ${r.expected}, Got: ${r.got}`);
      console.log(`    Reason: ${r.reason}`);
    });
  }
  
  console.log('\n✅ PASSED:');
  result.results.filter(r => r.match).forEach(r => {
    console.log(`  "${r.text}" → ${r.got} (${r.confidence})`);
  });
}

run().catch(console.error);
