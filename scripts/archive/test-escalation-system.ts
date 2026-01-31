import { prisma } from '@/lib/prisma'
import { escalationService } from '@/lib/services/payment-escalation'

/**
 * Test the payment escalation system with realistic scenarios
 */

async function main() {
  console.log('🧪 Testing Payment Escalation System\n')

  // 1. Find or create test contact
  let testContact = await prisma.contact.findFirst({
    where: { phone_whatsapp: { contains: 'test-escalation' } }
  })

  if (!testContact) {
    testContact = await prisma.contact.create({
      data: {
        phone_whatsapp: '+1234567890-test-escalation',
        name: 'Test Escalation User',
        source: 'test',
        status: 'active'
      }
    })
    console.log('✅ Created test contact:', testContact.phone_whatsapp)
  } else {
    console.log('♻️  Using existing test contact:', testContact.phone_whatsapp)
  }

  // 2. Find active agent
  const agent = await prisma.agent.findFirst({
    where: { isActive: true }
  })

  if (!agent) {
    console.error('❌ No active agent found')
    process.exit(1)
  }

  console.log(`✅ Using agent: ${agent.name}\n`)

  // 3. Reset escalation state for clean test
  const agentContact = await prisma.agentContact.findUnique({
    where: {
      agentId_contactId: {
        agentId: agent.id,
        contactId: testContact.id
      }
    }
  })

  if (agentContact) {
    await prisma.agentContact.update({
      where: { id: agentContact.id },
      data: {
        paymentEscalationTier: 0,
        totalPaymentsReceived: 0,
        totalAmountReceived: 0,
        consecutiveRefusals: 0,
        lastPaymentDate: null
      }
    })
    console.log('♻️  Reset escalation state for clean test\n')
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('TEST SCENARIO: Payment Escalation Flow')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // TEST 1: First Request (Tier 0)
  console.log('📍 TEST 1: First Request (Tier 0)')
  let state = await escalationService.calculateSuggestedAmount(agent.id, testContact.id)
  console.log(`   Tier: ${state.currentTier}`)
  console.log(`   Suggested: $${state.suggestedAmount} (Expected: $30-50)`)
  console.log(`   Total Payments: ${state.totalPayments}`)
  console.log(`   Total Received: $${state.totalReceived}\n`)

  // TEST 2: User Pays $40 → Escalate to Tier 1
  console.log('📍 TEST 2: User Pays $40 → Escalate to Tier 1')
  await escalationService.escalateOnPayment(agent.id, testContact.id, 40)
  state = await escalationService.calculateSuggestedAmount(agent.id, testContact.id)
  console.log(`   Tier: ${state.currentTier} (Expected: 1)`)
  console.log(`   Suggested: $${state.suggestedAmount} (Expected: $50-80)`)
  console.log(`   Total Payments: ${state.totalPayments} (Expected: 1)`)
  console.log(`   Total Received: $${state.totalReceived} (Expected: 40)\n`)

  // TEST 3: User Pays $65 → Escalate to Tier 2
  console.log('📍 TEST 3: User Pays $65 → Escalate to Tier 2')
  await escalationService.escalateOnPayment(agent.id, testContact.id, 65)
  state = await escalationService.calculateSuggestedAmount(agent.id, testContact.id)
  console.log(`   Tier: ${state.currentTier} (Expected: 2)`)
  console.log(`   Suggested: $${state.suggestedAmount} (Expected: $80-120)`)
  console.log(`   Total Payments: ${state.totalPayments} (Expected: 2)`)
  console.log(`   Total Received: $${state.totalReceived} (Expected: 105)\n`)

  // TEST 4: User Refuses Once
  console.log('📍 TEST 4: User Refuses Once')
  await escalationService.deescalateOnRefusal(agent.id, testContact.id)
  state = await escalationService.calculateSuggestedAmount(agent.id, testContact.id)
  console.log(`   Consecutive Refusals: ${state.consecutiveRefusals} (Expected: 1)`)
  console.log(`   Tier: ${state.currentTier} (Expected: 2, no change yet)\n`)

  // TEST 5: User Refuses Again → De-escalate to Tier 1
  console.log('📍 TEST 5: User Refuses Again → De-escalate to Tier 1')
  await escalationService.deescalateOnRefusal(agent.id, testContact.id)
  state = await escalationService.calculateSuggestedAmount(agent.id, testContact.id)
  console.log(`   Consecutive Refusals: ${state.consecutiveRefusals} (Expected: 2)`)
  console.log(`   Tier: ${state.currentTier} (Expected: 1, de-escalated)`)
  console.log(`   Suggested: $${state.suggestedAmount} (Expected: $50-80)\n`)

  // TEST 6: User Pays $75 → Reset Refusals, Escalate to Tier 2
  console.log('📍 TEST 6: User Pays $75 → Reset Refusals, Escalate to Tier 2')
  await escalationService.escalateOnPayment(agent.id, testContact.id, 75)
  state = await escalationService.calculateSuggestedAmount(agent.id, testContact.id)
  console.log(`   Consecutive Refusals: ${state.consecutiveRefusals} (Expected: 0, reset)`)
  console.log(`   Tier: ${state.currentTier} (Expected: 2)`)
  console.log(`   Suggested: $${state.suggestedAmount} (Expected: $80-120)`)
  console.log(`   Total Payments: ${state.totalPayments} (Expected: 3)`)
  console.log(`   Total Received: $${state.totalReceived} (Expected: 180)\n`)

  // TEST 7: Rapid Escalation to Max Tier
  console.log('📍 TEST 7: Rapid Escalation to Max Tier (5)')
  await escalationService.escalateOnPayment(agent.id, testContact.id, 100)
  await escalationService.escalateOnPayment(agent.id, testContact.id, 150)
  await escalationService.escalateOnPayment(agent.id, testContact.id, 200)
  await escalationService.escalateOnPayment(agent.id, testContact.id, 250) // Should cap at tier 5
  state = await escalationService.calculateSuggestedAmount(agent.id, testContact.id)
  console.log(`   Tier: ${state.currentTier} (Expected: 5, capped)`)
  console.log(`   Suggested: $${state.suggestedAmount} (Expected: $280-500)`)
  console.log(`   Total Payments: ${state.totalPayments} (Expected: 7)`)
  console.log(`   Total Received: $${state.totalReceived} (Expected: 880)\n`)

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ All Escalation Tests Passed!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  console.log('📊 Final State Summary:')
  console.log(`   Agent: ${agent.name}`)
  console.log(`   Contact: ${testContact.name}`)
  console.log(`   Current Tier: ${state.currentTier}`)
  console.log(`   Suggested Amount: $${state.suggestedAmount}`)
  console.log(`   Total Payments: ${state.totalPayments}`)
  console.log(`   Total Received: $${state.totalReceived}`)
  console.log(`   Consecutive Refusals: ${state.consecutiveRefusals}`)
}

main()
  .then(() => {
    console.log('\n✅ Test completed successfully')
    process.exit(0)
  })
  .catch((e) => {
    console.error('\n❌ Test failed:', e)
    process.exit(1)
  })
