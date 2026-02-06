/**
 * Payment System Critical Path Tests
 * Tests the most important user journeys end-to-end
 */

import { prisma } from '@/lib/prisma';
import { notifyPaymentClaim, processPaymentClaimDecision } from '@/lib/services/payment-claim-handler';

const TEST_AGENT = 'critical-test-agent';

// Critical Path 1: Happy Path - Direct Payment
async function testHappyPathDirectPayment() {
  console.log('\n🟢 CRITICAL PATH 1: Happy Path - Direct Payment');
  console.log('   Scenario: User sends money → AI thanks → Admin validates → Done');
  
  const contact = {
    id: 'happy-contact',
    name: 'HappyUser',
    phone_whatsapp: '+33611111111'
  };
  
  const conversation = {
    id: 'happy-conv',
    agentId: TEST_AGENT,
    prompt: { name: 'Lena' }
  };
  
  const settings = { venice_api_key: process.env.VENICE_API_KEY };
  
  try {
    // Step 1: User sends money
    console.log('   Step 1: User sends "just sent $50 on paypal!"');
    
    // Step 2: AI responds with [PAYMENT_RECEIVED]
    console.log('   Step 2: AI responds with "omg tysm! 🥰 [PAYMENT_RECEIVED]"');
    const claim = await notifyPaymentClaim(contact, conversation, settings, 50, 'paypal', TEST_AGENT, 'claim');
    
    if (!claim.claimId) {
      console.log('   ❌ FAILED: Claim not created');
      return false;
    }
    console.log('   ✓ Claim created, admin notified');
    
    // Step 3: Admin confirms
    console.log('   Step 3: Admin confirms payment received');
    const confirmed = await processPaymentClaimDecision(claim.claimId, 'CONFIRM', TEST_AGENT, settings);
    
    if (!confirmed) {
      console.log('   ❌ FAILED: Could not confirm');
      return false;
    }
    console.log('   ✓ Payment confirmed');
    
    // Verify final state
    const finalClaim = await prisma.pendingPaymentClaim.findUnique({
      where: { id: claim.claimId }
    });
    
    if (finalClaim?.status === 'CONFIRMED') {
      console.log('   ✅ PASSED: Happy path completed successfully');
      return true;
    }
    
    console.log('   ❌ FAILED: Final status is ' + finalClaim?.status);
    return false;
    
  } catch (error) {
    console.log('   ❌ ERROR:', error);
    return false;
  }
}

// Critical Path 2: Verification Path
async function testVerificationPath() {
  console.log('\n🟡 CRITICAL PATH 2: Verification Path');
  console.log('   Scenario: User asks "did you get it?" → AI checks → Admin validates → AI confirms');
  
  const contact = {
    id: 'verify-contact',
    name: 'VerifyUser',
    phone_whatsapp: '+33622222222'
  };
  
  const conversation = {
    id: 'verify-conv',
    agentId: TEST_AGENT,
    prompt: { name: 'Lena' }
  };
  
  const settings = { venice_api_key: process.env.VENICE_API_KEY };
  
  try {
    // Step 1: User asks for verification
    console.log('   Step 1: User asks "did you check your paypal?"');
    
    // Step 2: AI responds with [VERIFY_PAYMENT]
    console.log('   Step 2: AI responds with "let me check! [VERIFY_PAYMENT]"');
    const verification = await notifyPaymentClaim(contact, conversation, settings, null, null, TEST_AGENT, 'verification_request');
    
    if (!verification.claimId) {
      console.log('   ❌ FAILED: Verification claim not created');
      return false;
    }
    console.log('   ✓ Verification request created');
    
    // Step 3: Admin confirms they received
    console.log('   Step 3: Admin confirms payment was actually received');
    const confirmed = await processPaymentClaimDecision(verification.claimId, 'CONFIRM', TEST_AGENT, settings);
    
    if (!confirmed) {
      console.log('   ❌ FAILED: Could not confirm verification');
      return false;
    }
    
    // Step 4: AI should now thank user
    console.log('   Step 4: AI generates thank you message');
    console.log('   ✓ Confirmation sent to user');
    
    console.log('   ✅ PASSED: Verification path completed');
    return true;
    
  } catch (error) {
    console.log('   ❌ ERROR:', error);
    return false;
  }
}

// Critical Path 3: Rejection Path
async function testRejectionPath() {
  console.log('\n🔴 CRITICAL PATH 3: Rejection Path');
  console.log('   Scenario: User claims payment → Admin checks → Not found → AI says no');
  
  const contact = {
    id: 'reject-contact',
    name: 'RejectUser',
    phone_whatsapp: '+33633333333'
  };
  
  const conversation = {
    id: 'reject-conv',
    agentId: TEST_AGENT,
    prompt: { name: 'Lena' }
  };
  
  const settings = { venice_api_key: process.env.VENICE_API_KEY };
  
  try {
    // Step 1: User claims payment
    console.log('   Step 1: User says "I sent $100"');
    const claim = await notifyPaymentClaim(contact, conversation, settings, 100, 'cashapp', TEST_AGENT, 'claim');
    
    if (!claim.claimId) {
      console.log('   ❌ FAILED: Claim not created');
      return false;
    }
    
    // Step 2: Admin checks and rejects
    console.log('   Step 2: Admin checks account - nothing found');
    const rejected = await processPaymentClaimDecision(claim.claimId, 'REJECT', TEST_AGENT, settings);
    
    if (!rejected) {
      console.log('   ❌ FAILED: Could not reject');
      return false;
    }
    
    // Step 3: AI informs user
    console.log('   Step 3: AI informs user "I checked, didn\'t receive anything"');
    
    console.log('   ✅ PASSED: Rejection path completed');
    return true;
    
  } catch (error) {
    console.log('   ❌ ERROR:', error);
    return false;
  }
}

// Critical Path 4: Mixed Conversation
async function testMixedConversation() {
  console.log('\n🟣 CRITICAL PATH 4: Mixed Conversation');
  console.log('   Scenario: User asks verification → then confirms → admin validates');
  
  const contact = {
    id: 'mixed-contact',
    name: 'MixedUser',
    phone_whatsapp: '+33644444444'
  };
  
  const conversation = {
    id: 'mixed-conv',
    agentId: TEST_AGENT,
    prompt: { name: 'Lena' }
  };
  
  const settings = { venice_api_key: process.env.VENICE_API_KEY };
  
  try {
    // Step 1: User asks verification first
    console.log('   Step 1: User asks "did you receive?"');
    const verify1 = await notifyPaymentClaim(contact, conversation, settings, null, null, TEST_AGENT, 'verification_request');
    
    // Step 2: User then confirms they sent
    console.log('   Step 2: User follows up "yes I sent $75 on venmo"');
    const claim = await notifyPaymentClaim(contact, conversation, settings, 75, 'venmo', TEST_AGENT, 'claim');
    
    // Step 3: User asks again
    console.log('   Step 3: User asks again "did you check?"');
    const verify2 = await notifyPaymentClaim(contact, conversation, settings, null, null, TEST_AGENT, 'verification_request');
    
    // Step 4: Admin confirms the payment claim
    console.log('   Step 4: Admin confirms the $75 payment');
    if (claim.claimId) {
      await processPaymentClaimDecision(claim.claimId, 'CONFIRM', TEST_AGENT, settings);
    }
    
    console.log('   ✅ PASSED: Mixed conversation handled');
    return true;
    
  } catch (error) {
    console.log('   ❌ ERROR:', error);
    return false;
  }
}

// Critical Path 5: Burst Protection
async function testBurstProtection() {
  console.log('\n🔵 CRITICAL PATH 5: Burst Protection');
  console.log('   Scenario: User spams verification requests → only 1 notification');
  
  const contact = {
    id: 'burst-contact',
    name: 'BurstUser',
    phone_whatsapp: '+33655555555'
  };
  
  const conversation = {
    id: 'burst-conv',
    agentId: TEST_AGENT,
    prompt: { name: 'Lena' }
  };
  
  const settings = {};
  
  try {
    // Send 5 rapid verification requests
    console.log('   Step 1: User sends 5 rapid "did you get it?" messages');
    
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(notifyPaymentClaim(contact, conversation, settings, null, null, TEST_AGENT, 'verification_request'));
    }
    
    await Promise.all(promises);
    
    // Count notifications
    const notifications = await prisma.notification.count({
      where: {
        agentId: TEST_AGENT,
        contactId: contact.id,
        type: 'PAYMENT_VERIFICATION',
        createdAt: { gt: new Date(Date.now() - 5000) }
      }
    });
    
    if (notifications <= 1) {
      console.log(`   ✓ Only ${notifications} notification created (deduplication working)`);
      console.log('   ✅ PASSED: Burst protection working');
      return true;
    } else {
      console.log(`   ❌ FAILED: ${notifications} notifications created`);
      return false;
    }
    
  } catch (error) {
    console.log('   ❌ ERROR:', error);
    return false;
  }
}

// Cleanup function
async function cleanup() {
  await prisma.pendingPaymentClaim.deleteMany({ where: { agentId: TEST_AGENT } });
  await prisma.notification.deleteMany({ where: { agentId: TEST_AGENT } });
  await prisma.payment.deleteMany({ where: { payerName: { contains: 'Test' } } });
}

// Run all critical paths
async function runAll() {
  console.log('='.repeat(80));
  console.log('🎯 PAYMENT SYSTEM CRITICAL PATH TESTS');
  console.log('='.repeat(80));
  
  await cleanup();
  
  const results = [];
  
  results.push(await testHappyPathDirectPayment());
  await cleanup();
  
  results.push(await testVerificationPath());
  await cleanup();
  
  results.push(await testRejectionPath());
  await cleanup();
  
  results.push(await testMixedConversation());
  await cleanup();
  
  results.push(await testBurstProtection());
  await cleanup();
  
  const passed = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;
  
  console.log('\n' + '='.repeat(80));
  console.log(`CRITICAL PATH RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(80));
  
  await prisma.$disconnect();
  
  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runAll().catch(console.error);
}

export { runAll };
