import { classifyPaymentIntent } from '@/lib/services/payment-intent-classifier';

const tests = [
  // Avec contexte paiement
  {
    msg: 'did you check?',
    ctx: [
      {role: 'assistant', content: 'my paypal is lena9200'},
      {role: 'user', content: 'I sent you money'}
    ],
    expected: 'VERIFICATION'
  },
  // Sans contexte
  {
    msg: 'did you check?',
    ctx: [],
    expected: 'NONE'
  },
  // Confirmation
  {
    msg: 'sent!',
    ctx: [{role: 'assistant', content: 'paypal: lena9200'}],
    expected: 'CONFIRMATION'
  },
  // Video (pas paiement)
  {
    msg: 'check this video',
    ctx: [],
    expected: 'NONE'
  }
];

async function run() {
  for (const test of tests) {
    console.log(`\n🧪 "${test.msg}"`);
    if (test.ctx.length > 0) {
      console.log('Context:', test.ctx.map(c => c.content.substring(0, 30)).join(' | '));
    }
    
    const result = await classifyPaymentIntent(test.msg, test.ctx);
    
    const status = result.intent === test.expected ? '✅' : '❌';
    console.log(`${status} ${result.intent} (expected: ${test.expected})`);
    console.log(`Reason: ${result.reason}`);
  }
}

run().catch(console.error);
