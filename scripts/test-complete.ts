import { batchClassify } from '@/lib/services/payment-intent-classifier';

const tests = [
  // === AVEC CONTEXTE PAIEMENT ===
  { msg: 'did you check?', ctx: [{role: 'assistant', content: 'paypal: lena9200'}, {role: 'user', content: 'I sent money'}], expected: 'VERIFICATION' },
  { msg: 'did you receive?', ctx: [{role: 'user', content: 'I transferred $100'}], expected: 'VERIFICATION' },
  { msg: 'tu as reçu?', ctx: [{role: 'assistant', content: 'voici mon paypal'}, {role: 'user', content: 'jai envoyé'}], expected: 'VERIFICATION' },
  { msg: 'check your paypal', ctx: [{role: 'user', content: 'sent you money'}], expected: 'VERIFICATION' },
  { msg: 'you got it?', ctx: [{role: 'user', content: 'just sent $50'}], expected: 'VERIFICATION' },
  { msg: 'did you see it?', ctx: [{role: 'user', content: 'transferred the payment'}], expected: 'VERIFICATION' },
  { msg: 'sent!', ctx: [{role: 'assistant', content: 'paypal: lena9200'}], expected: 'CONFIRMATION' },
  { msg: 'just sent $50', ctx: [{role: 'assistant', content: 'here is my venmo'}], expected: 'CONFIRMATION' },
  { msg: 'payment done', ctx: [{role: 'assistant', content: 'zelle: 123456'}], expected: 'CONFIRMATION' },
  
  // === SANS CONTEXTE (doit être NONE) ===
  { msg: 'did you check?', ctx: [], expected: 'NONE' },
  { msg: 'did you receive?', ctx: [], expected: 'NONE' },
  { msg: 'you got it?', ctx: [], expected: 'NONE' },
  { msg: 'sent!', ctx: [], expected: 'NONE' },
  { msg: 'tu as reçu?', ctx: [], expected: 'NONE' },
  
  // === CAS CLAIRS NONE ===
  { msg: 'how are you?', ctx: [], expected: 'NONE' },
  { msg: 'check this video', ctx: [], expected: 'NONE' },
  { msg: 'did you receive my message?', ctx: [], expected: 'NONE' },
  { msg: 'I need money for rent', ctx: [], expected: 'NONE' },
  { msg: 'I will send tomorrow', ctx: [], expected: 'NONE' },
  { msg: 'do you have paypal?', ctx: [], expected: 'NONE' },
  { msg: 'let me check my account', ctx: [], expected: 'NONE' },
  { msg: 'did you see the news?', ctx: [], expected: 'NONE' },
  
  // === EDGE CASES ===
  { msg: 'jai envoyé check ton paypal', ctx: [], expected: 'VERIFICATION' },
  { msg: 'I sent it, did you get it?', ctx: [], expected: 'VERIFICATION' },
  { msg: 'sent! did you see it?', ctx: [], expected: 'VERIFICATION' },
];

async function run() {
  console.log('TEST COMPLET - 100% TARGET\n');
  const result = await batchClassify(tests);
  
  console.log(`\nResults: ${result.passed}/${result.total} (${((result.passed/result.total)*100).toFixed(1)}%)`);
  
  if (result.failed > 0) {
    console.log('\n❌ FAILURES:');
    result.results.filter(r => !r.match).forEach(r => {
      console.log(`  "${r.msg}" → expected ${r.expected}, got ${r.got}`);
      console.log(`    ${r.reason}\n`);
    });
  }
}

run().catch(console.error);
