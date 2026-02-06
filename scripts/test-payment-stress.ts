/**
 * Payment System Stress Tests
 * Tests: race conditions, double submissions, rapid messages, edge cases
 */

import { prisma } from '@/lib/prisma';
import { notifyPaymentClaim, processPaymentClaimDecision } from '@/lib/services/payment-claim-handler';

// Test data
const TEST_AGENT_ID = 'stress-test-agent';
const TEST_CONTACT_ID = 'stress-test-contact';

async function cleanup() {
  // Clean up test data
  await prisma.pendingPaymentClaim.deleteMany({
    where: { agentId: TEST_AGENT_ID }
  });
  await prisma.notification.deleteMany({
    where: { agentId: TEST_AGENT_ID }
  });
}

async function testRaceCondition() {
  console.log('\n🏎️  TEST: Race Condition - Double notification');
  
  const mockContact = {
    id: TEST_CONTACT_ID,
    name: 'RaceTest',
    phone_whatsapp: '+33600000001'
  };
  
  const mockConversation = {
    id: 'race-conv-1',
    agentId: TEST_AGENT_ID
  };
  
  const mockSettings = {};
  
  // Simulate two simultaneous calls
  const promise1 = notifyPaymentClaim(mockContact, mockConversation, mockSettings, 100, 'paypal', TEST_AGENT_ID, 'claim');
  const promise2 = notifyPaymentClaim(mockContact, mockConversation, mockSettings, 100, 'paypal', TEST_AGENT_ID, 'claim');
  
  const [result1, result2] = await Promise.all([promise1, promise2]);
  
  // Check only one claim was created
  const claims = await prisma.pendingPaymentClaim.findMany({
    where: { 
      contactId: TEST_CONTACT_ID,
      createdAt: { gt: new Date(Date.now() - 5000) }
    }
  });
  
  if (claims.length === 1) {
    console.log('   ✅ PASSED: Race condition handled, only 1 claim created');
    return true;
  } else {
    console.log(`   ❌ FAILED: ${claims.length} claims created instead of 1`);
    return false;
  }
}

async function testRapidVerificationAndClaim() {
  console.log('\n⚡ TEST: Rapid Verification → Claim');
  
  const mockContact = {
    id: 'rapid-contact',
    name: 'RapidTest',
    phone_whatsapp: '+33600000002'
  };
  
  const mockConversation = {
    id: 'rapid-conv',
    agentId: TEST_AGENT_ID
  };
  
  const mockSettings = {};
  
  // Step 1: User asks for verification
  const verifyResult = await notifyPaymentClaim(
    mockContact, mockConversation, mockSettings, 
    null, null, TEST_AGENT_ID, 'verification_request'
  );
  
  // Step 2: Immediately after, user confirms they sent (before admin responds)
  const claimResult = await notifyPaymentClaim(
    mockContact, mockConversation, mockSettings,
    50, 'paypal', TEST_AGENT_ID, 'claim'
  );
  
  // Check both notifications exist
  const notifications = await prisma.notification.findMany({
    where: {
      agentId: TEST_AGENT_ID,
      createdAt: { gt: new Date(Date.now() - 5000) }
    },
    orderBy: { createdAt: 'asc' }
  });
  
  const hasVerification = notifications.some(n => n.type === 'PAYMENT_VERIFICATION');
  const hasClaim = notifications.some(n => n.type === 'PAYMENT_CLAIM');
  
  if (hasVerification && hasClaim) {
    console.log('   ✅ PASSED: Both verification and claim notifications created');
    return true;
  } else {
    console.log(`   ❌ FAILED: Verification=${hasVerification}, Claim=${hasClaim}`);
    return false;
  }
}

async function testClaimConfirmationFlow() {
  console.log('\n✅ TEST: Claim → Confirmation Flow');
  
  const mockContact = {
    id: 'flow-contact',
    name: 'FlowTest',
    phone_whatsapp: '+33600000003'
  };
  
  const mockConversation = {
    id: 'flow-conv',
    agentId: TEST_AGENT_ID,
    prompt: { name: 'Lena' }
  };
  
  const mockSettings = {
    venice_api_key: process.env.VENICE_API_KEY
  };
  
  // Step 1: Create claim
  const claimResult = await notifyPaymentClaim(
    mockContact, mockConversation, mockSettings,
    75, 'cashapp', TEST_AGENT_ID, 'claim'
  );
  
  if (!claimResult.claimId) {
    console.log('   ❌ FAILED: Could not create claim');
    return false;
  }
  
  // Step 2: Confirm claim
  const confirmResult = await processPaymentClaimDecision(
    claimResult.claimId,
    'CONFIRM',
    TEST_AGENT_ID,
    mockSettings
  );
  
  if (!confirmResult) {
    console.log('   ❌ FAILED: Could not confirm claim');
    return false;
  }
  
  // Step 3: Verify claim status updated
  const claim = await prisma.pendingPaymentClaim.findUnique({
    where: { id: claimResult.claimId }
  });
  
  if (claim?.status === 'CONFIRMED') {
    console.log('   ✅ PASSED: Claim confirmed successfully');
    return true;
  } else {
    console.log(`   ❌ FAILED: Claim status is ${claim?.status}, expected CONFIRMED`);
    return false;
  }
}

async function testClaimRejectionFlow() {
  console.log('\n❌ TEST: Claim → Rejection Flow');
  
  const mockContact = {
    id: 'reject-contact',
    name: 'RejectTest',
    phone_whatsapp: '+33600000004'
  };
  
  const mockConversation = {
    id: 'reject-conv',
    agentId: TEST_AGENT_ID,
    prompt: { name: 'Lena' }
  };
  
  const mockSettings = {
    venice_api_key: process.env.VENICE_API_KEY
  };
  
  // Step 1: Create claim
  const claimResult = await notifyPaymentClaim(
    mockContact, mockConversation, mockSettings,
    100, 'venmo', TEST_AGENT_ID, 'claim'
  );
  
  if (!claimResult.claimId) {
    console.log('   ❌ FAILED: Could not create claim');
    return false;
  }
  
  // Step 2: Reject claim
  const rejectResult = await processPaymentClaimDecision(
    claimResult.claimId,
    'REJECT',
    TEST_AGENT_ID,
    mockSettings
  );
  
  if (!rejectResult) {
    console.log('   ❌ FAILED: Could not reject claim');
    return false;
  }
  
  // Step 3: Verify claim status updated
  const claim = await prisma.pendingPaymentClaim.findUnique({
    where: { id: claimResult.claimId }
  });
  
  if (claim?.status === 'REJECTED') {
    console.log('   ✅ PASSED: Claim rejected successfully');
    return true;
  } else {
    console.log(`   ❌ FAILED: Claim status is ${claim?.status}, expected REJECTED`);
    return false;
  }
}

async function testDuplicatePrevention() {
  console.log('\n🛡️  TEST: Duplicate Claim Prevention');
  
  const mockContact = {
    id: 'dup-contact',
    name: 'DupTest',
    phone_whatsapp: '+33600000005'
  };
  
  const mockConversation = {
    id: 'dup-conv',
    agentId: TEST_AGENT_ID
  };
  
  const mockSettings = {};
  
  // Create first claim
  const result1 = await notifyPaymentClaim(
    mockContact, mockConversation, mockSettings,
    50, 'paypal', TEST_AGENT_ID, 'claim'
  );
  
  // Try to create second claim immediately (should be deduplicated)
  const result2 = await notifyPaymentClaim(
    mockContact, mockConversation, mockSettings,
    50, 'paypal', TEST_AGENT_ID, 'claim'
  );
  
  // Both should reference the same claim
  if (result1.claimId === result2.claimId) {
    console.log('   ✅ PASSED: Duplicate prevented, same claim ID returned');
    return true;
  } else {
    console.log(`   ❌ FAILED: Two different claims created: ${result1.claimId} vs ${result2.claimId}`);
    return false;
  }
}

async function testVerificationThenConfirmation() {
  console.log('\n🔄 TEST: Verification → User Confirms → Payment Flow');
  
  const mockContact = {
    id: 'sequence-contact',
    name: 'SequenceTest',
    phone_whatsapp: '+33600000006'
  };
  
  const mockConversation = {
    id: 'sequence-conv',
    agentId: TEST_AGENT_ID,
    prompt: { name: 'Lena' }
  };
  
  const mockSettings = {
    venice_api_key: process.env.VENICE_API_KEY
  };
  
  // Step 1: User asks for verification
  const verifyResult = await notifyPaymentClaim(
    mockContact, mockConversation, mockSettings,
    null, null, TEST_AGENT_ID, 'verification_request'
  );
  
  // Step 2: User then confirms they actually sent (separate message)
  const claimResult = await notifyPaymentClaim(
    mockContact, mockConversation, mockSettings,
    200, 'bank', TEST_AGENT_ID, 'claim'
  );
  
  // Step 3: Admin confirms
  if (claimResult.claimId) {
    await processPaymentClaimDecision(
      claimResult.claimId,
      'CONFIRM',
      TEST_AGENT_ID,
      mockSettings
    );
  }
  
  // Verify final state
  const claims = await prisma.pendingPaymentClaim.findMany({
    where: {
      contactId: 'sequence-contact',
      createdAt: { gt: new Date(Date.now() - 10000) }
    }
  });
  
  const hasVerification = claims.some(c => c.metadata && (c.metadata as any).type === 'verification_request');
  const hasConfirmedClaim = claims.some(c => c.status === 'CONFIRMED');
  
  if (hasVerification && hasConfirmedClaim) {
    console.log('   ✅ PASSED: Full flow completed successfully');
    return true;
  } else {
    console.log(`   ❌ FAILED: Verification=${hasVerification}, Confirmed=${hasConfirmedClaim}`);
    return false;
  }
}

async function runAllStressTests() {
  console.log('='.repeat(80));
  console.log('PAYMENT SYSTEM STRESS TESTS');
  console.log('='.repeat(80));
  
  await cleanup();
  
  const results = [];
  
  results.push(await testRaceCondition());
  results.push(await testRapidVerificationAndClaim());
  results.push(await testDuplicatePrevention());
  results.push(await testClaimConfirmationFlow());
  results.push(await testClaimRejectionFlow());
  results.push(await testVerificationThenConfirmation());
  
  await cleanup();
  
  const passed = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;
  
  console.log('\n' + '='.repeat(80));
  console.log(`STRESS TEST RESULTS: ${passed} passed, ${failed} failed out of ${results.length}`);
  console.log('='.repeat(80));
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runAllStressTests()
    .catch(console.error)
    .finally(async () => {
      await cleanup();
      await prisma.$disconnect();
    });
}

export { runAllStressTests };
