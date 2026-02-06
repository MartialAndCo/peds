import { classifyPaymentIntent } from '@/lib/services/payment-intent-classifier';

async function test() {
  console.log('Test: "did you check?" avec contexte de paiement\n');
  
  // Cas 1: Sans contexte
  console.log('1. Sans contexte:');
  const r1 = await classifyPaymentIntent('did you check?', []);
  console.log(`   Résultat: ${r1.intent} (confiance: ${r1.confidence})`);
  console.log(`   Raison: ${r1.reason}`);
  
  // Cas 2: Avec contexte de paiement
  console.log('\n2. Avec contexte (PayPal partagé + user dit avoir envoyé):');
  const r2 = await classifyPaymentIntent('did you check?', [
    { role: 'assistant', content: 'my paypal is lena9200' },
    { role: 'user', content: 'I sent you money' },
    { role: 'assistant', content: 'really? thanks!' }
  ]);
  console.log(`   Résultat: ${r2.intent} (confiance: ${r2.confidence})`);
  console.log(`   Raison: ${r2.reason}`);
  
  // Cas 3: Avec contexte général
  console.log('\n3. Avec contexte général (pas de paiement):');
  const r3 = await classifyPaymentIntent('did you check?', [
    { role: 'user', content: 'how are you?' },
    { role: 'assistant', content: 'im good!' },
    { role: 'user', content: 'did you check?' }
  ]);
  console.log(`   Résultat: ${r3.intent} (confiance: ${r3.confidence})`);
  console.log(`   Raison: ${r3.reason}`);
}

test().catch(console.error);
