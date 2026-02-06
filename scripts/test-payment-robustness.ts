/**
 * Payment System Robustness Tests
 * Tests all scenarios: direct send, verification requests, edge cases
 */

import { paymentNode } from '@/lib/swarm/nodes/payment-node';
import { notifyPaymentClaim, processPaymentClaimDecision } from '@/lib/services/payment-claim-handler';

// Mock data
const mockState = (userMessage: string): any => ({
  userMessage,
  agentId: 'test-agent-123',
  conversationId: 'conv-456',
  contexts: {}
});

const mockContact = {
  id: 'contact-789',
  name: 'TestUser',
  phone_whatsapp: '+33612345678'
};

const mockConversation = {
  id: 'conv-456',
  agentId: 'test-agent-123',
  prompt: { name: 'Lena', system_prompt: 'You are Lena...' }
};

const mockSettings = {
  venice_api_key: process.env.VENICE_API_KEY,
  venice_model: 'venice-uncensored',
  payment_paypal_enabled: 'true',
  payment_paypal_username: 'lena9200'
};

// Test scenarios
const TEST_SCENARIOS = [
  // === SCÉNARIO A: Envoi direct ===
  {
    name: 'A1 - Envoi direct simple (EN)',
    message: 'I sent you $50',
    expectTag: 'PAYMENT_RECEIVED',
    expectVerification: false,
    description: 'User confirms payment sent directly'
  },
  {
    name: 'A2 - Envoi direct avec PayPal (EN)',
    message: 'just sent 100 on paypal',
    expectTag: 'PAYMENT_RECEIVED',
    expectVerification: false,
    description: 'User mentions PayPal and sent'
  },
  {
    name: 'A3 - Envoi direct (FR)',
    message: 'je viens de t\'envoyer 200€',
    expectTag: 'PAYMENT_RECEIVED',
    expectVerification: false,
    description: 'French direct payment confirmation'
  },
  {
    name: 'A4 - Envoi avec done',
    message: 'done! sent the money',
    expectTag: 'PAYMENT_RECEIVED',
    expectVerification: false,
    description: 'User uses "done" to confirm'
  },
  {
    name: 'A5 - Transfert effectué',
    message: 'transfer done to your account',
    expectTag: 'PAYMENT_RECEIVED',
    expectVerification: false,
    description: 'User mentions transfer completed'
  },

  // === SCÉNARIO B: Demande de vérification ===
  {
    name: 'B1 - Demande simple (EN)',
    message: 'did you check?',
    expectTag: 'VERIFY_PAYMENT',
    expectVerification: true,
    description: 'User asks if payment was received'
  },
  {
    name: 'B2 - Demande complète (EN)',
    message: 'did you receive the money I sent?',
    expectTag: 'VERIFY_PAYMENT',
    expectVerification: true,
    description: 'User asks about specific payment'
  },
  {
    name: 'B3 - Demande (FR)',
    message: 'tu as reçu?',
    expectTag: 'VERIFY_PAYMENT',
    expectVerification: true,
    description: 'French verification request'
  },
  {
    name: 'B4 - Check ton compte',
    message: 'check your paypal',
    expectTag: 'VERIFY_PAYMENT',
    expectVerification: true,
    description: 'User asks to check account'
  },
  {
    name: 'B5 - Est-ce arrivé',
    message: 'est-ce que c\'est arrivé?',
    expectTag: 'VERIFY_PAYMENT',
    expectVerification: true,
    description: 'French asking if it arrived'
  },
  {
    name: 'B6 - You got it',
    message: 'you got it?',
    expectTag: 'VERIFY_PAYMENT',
    expectVerification: true,
    description: 'Casual verification request'
  },

  // === EDGE CASES: Messages ambigus ou faux positifs ===
  {
    name: 'E1 - Discussion sans paiement',
    message: 'how are you today?',
    expectTag: null,
    expectVerification: false,
    description: 'Normal conversation, no payment context'
  },
  {
    name: 'E2 - Demande de check (non paiement)',
    message: 'check this video I sent you',
    expectTag: null,
    expectVerification: false,
    description: 'Check but not about payment'
  },
  {
    name: 'E3 - Discussion argent sans envoi',
    message: 'I need money for rent',
    expectTag: null,
    expectVerification: false,
    description: 'Mentions money but not sending'
  },
  {
    name: 'E4 - Promesse future',
    message: 'I will send you money tomorrow',
    expectTag: null,
    expectVerification: false,
    description: 'Future promise, not confirmation'
  },
  {
    name: 'E5 - Question sur méthode',
    message: 'do you have paypal?',
    expectTag: null,
    expectVerification: false,
    description: 'Asking about payment method only'
  },
  {
    name: 'E6 - Check comme vérification',
    message: 'let me check my account first',
    expectTag: null,
    expectVerification: false,
    description: 'User checking their own account'
  },
  {
    name: 'E7 - Receive mais pas argent',
    message: 'did you receive my last message?',
    expectTag: null,
    expectVerification: false,
    description: 'Receive but about message, not payment'
  },
  {
    name: 'E8 - Did you (générique)',
    message: 'did you see the news?',
    expectTag: null,
    expectVerification: false,
    description: 'Did you pattern but not payment'
  },

  // === EDGE CASES: Variations linguistiques ===
  {
    name: 'L1 - Vérification formelle',
    message: 'Avez-vous bien reçu le virement?',
    expectTag: 'VERIFY_PAYMENT',
    expectVerification: true,
    description: 'Formal French verification'
  },
  {
    name: 'L2 - Confirmation formelle',
    message: 'Le paiement a été effectué',
    expectTag: 'PAYMENT_RECEIVED',
    expectVerification: false,
    description: 'Formal French confirmation'
  },
  {
    name: 'L3 - Abbréviations',
    message: 'u got it?',
    expectTag: 'VERIFY_PAYMENT',
    expectVerification: true,
    description: 'Abbreviated text'
  },
  {
    name: 'L4 - SMS style',
    message: 'jai envoyé check ton paypal',
    expectTag: 'VERIFY_PAYMENT',
    expectVerification: true,
    description: 'SMS style with accent removed'
  },

  // === EDGE CASES: Doubles et répétitions ===
  {
    name: 'D1 - Double demande',
    message: 'did you check? did you get it?',
    expectTag: 'VERIFY_PAYMENT',
    expectVerification: true,
    description: 'Repeated verification request'
  },
  {
    name: 'D2 - Confirmation insistante',
    message: 'sent! done! transferred!',
    expectTag: 'PAYMENT_RECEIVED',
    expectVerification: false,
    description: 'Multiple confirmation words'
  },

  // === EDGE CASES: Contexte complexe ===
  {
    name: 'C1 - Montant spécifique',
    message: 'just sent you 10k on paypal, did you see it?',
    expectTag: 'VERIFY_PAYMENT',
    expectVerification: true,
    description: 'Specific amount with verification'
  },
  {
    name: 'C2 - Confirmation avec montant',
    message: 'sent 500 bucks!',
    expectTag: 'PAYMENT_RECEIVED',
    expectVerification: false,
    description: 'Confirmation with slang amount'
  },
  {
    name: 'C3 - Mixte ambigu',
    message: 'I sent it, did you get it?',
    expectTag: 'VERIFY_PAYMENT',
    expectVerification: true,
    description: 'Both sent and verification - should prioritize verification context'
  }
];

async function runTests() {
  console.log('='.repeat(80));
  console.log('PAYMENT SYSTEM ROBUSTNESS TESTS');
  console.log('='.repeat(80));
  
  let passed = 0;
  let failed = 0;
  
  for (const scenario of TEST_SCENARIOS) {
    try {
      console.log(`\n🧪 Testing: ${scenario.name}`);
      console.log(`   Input: "${scenario.message}"`);
      console.log(`   Description: ${scenario.description}`);
      
      // Test payment node detection
      const state = mockState(scenario.message);
      const result = await paymentNode(state);
      
      const paymentContext = result.contexts?.payment || '';
      
      // Check if verification instruction is present
      const hasVerificationInstruction = paymentContext.includes('USER IS ASKING IF YOU RECEIVED') || 
                                        paymentContext.includes('DEMANDE SI TU AS REÇU');
      
      // Check if confirmation instruction is present
      const hasConfirmationInstruction = paymentContext.includes('USER CONFIRMS THEY ALREADY SENT') ||
                                        paymentContext.includes('CONFIRME AVOIR DÉJÀ ENVOYÉ');
      
      // Determine actual behavior
      const detectedAsVerification = hasVerificationInstruction;
      const detectedAsConfirmation = hasConfirmationInstruction && !hasVerificationInstruction;
      
      // Validate
      let testPassed = true;
      let errors: string[] = [];
      
      if (scenario.expectVerification && !detectedAsVerification) {
        testPassed = false;
        errors.push(`Expected VERIFICATION but got ${detectedAsConfirmation ? 'CONFIRMATION' : 'NONE'}`);
      }
      
      if (!scenario.expectVerification && scenario.expectTag === 'PAYMENT_RECEIVED' && !detectedAsConfirmation) {
        testPassed = false;
        errors.push(`Expected CONFIRMATION but got ${detectedAsVerification ? 'VERIFICATION' : 'NONE'}`);
      }
      
      if (!scenario.expectVerification && scenario.expectTag === null && (detectedAsVerification || detectedAsConfirmation)) {
        testPassed = false;
        errors.push(`Expected NO TAG but detected ${detectedAsVerification ? 'VERIFICATION' : 'CONFIRMATION'}`);
      }
      
      if (testPassed) {
        console.log(`   ✅ PASSED`);
        if (detectedAsVerification) console.log(`   → Detected as: VERIFICATION REQUEST`);
        if (detectedAsConfirmation) console.log(`   → Detected as: PAYMENT CONFIRMATION`);
        if (!detectedAsVerification && !detectedAsConfirmation) console.log(`   → No payment context detected`);
        passed++;
      } else {
        console.log(`   ❌ FAILED`);
        errors.forEach(e => console.log(`   → Error: ${e}`));
        console.log(`   → Context excerpt: ${paymentContext.substring(0, 200)}...`);
        failed++;
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${TEST_SCENARIOS.length}`);
  console.log('='.repeat(80));
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { TEST_SCENARIOS };
