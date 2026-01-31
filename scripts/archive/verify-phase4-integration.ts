import { prisma } from '@/lib/prisma'
import { director } from '@/lib/director'
import { escalationService } from '@/lib/services/payment-escalation'

/**
 * Verify Phase 4 romantic + escalation integration end-to-end
 */

async function main() {
  console.log('🔍 Verifying Phase 4 Romantic + Escalation Integration\n')

  // 1. Get test contact and agent
  const agent = await prisma.agent.findFirst({
    where: { isActive: true, name: 'Lena' },
    include: { profile: true }
  })

  if (!agent) {
    console.error('❌ No active Lena agent found')
    process.exit(1)
  }

  let testContact = await prisma.contact.findFirst({
    where: { phone_whatsapp: { contains: 'test-phase4' } }
  })

  if (!testContact) {
    testContact = await prisma.contact.create({
      data: {
        phone_whatsapp: '+1234567890-test-phase4',
        name: 'Phase 4 Test User',
        source: 'test',
        status: 'active'
      }
    })
  }

  console.log(`✅ Agent: ${agent.name}`)
  console.log(`✅ Contact: ${testContact.name}`)
  console.log()

  // 2. Set up Phase 4 scenario with some payment history
  let agentContact = await prisma.agentContact.findUnique({
    where: {
      agentId_contactId: {
        agentId: agent.id,
        contactId: testContact.id
      }
    }
  })

  if (!agentContact) {
    agentContact = await prisma.agentContact.create({
      data: {
        agentId: agent.id,
        contactId: testContact.id,
        phase: 'MONEYPOT',
        trustScore: 85,
        paymentEscalationTier: 2, // Established tier
        totalPaymentsReceived: 3,
        totalAmountReceived: 185
      }
    })
    console.log('✅ Created AgentContact with Phase 4 + payment history')
  } else {
    await prisma.agentContact.update({
      where: { id: agentContact.id },
      data: {
        phase: 'MONEYPOT',
        trustScore: 85,
        paymentEscalationTier: 2,
        totalPaymentsReceived: 3,
        totalAmountReceived: 185
      }
    })
    console.log('✅ Updated AgentContact to Phase 4 + payment history')
  }

  console.log()
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('STEP 1: Check Escalation Service')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const escalationState = await escalationService.calculateSuggestedAmount(agent.id, testContact.id)
  console.log(`Current Tier: ${escalationState.currentTier}`)
  console.log(`Suggested Amount: $${escalationState.suggestedAmount}`)
  console.log(`Total Payments: ${escalationState.totalPayments}`)
  console.log(`Total Received: $${escalationState.totalReceived}`)
  console.log()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('STEP 2: Check Template Variables')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const template = agent.profile?.phaseMoneypotTemplate || ''
  const hasVariables = [
    '{{SUGGESTED_AMOUNT}}',
    '{{CURRENT_TIER}}',
    '{{TOTAL_PAYMENTS}}',
    '{{TOTAL_RECEIVED}}'
  ]

  console.log('Template contains dynamic variables:')
  hasVariables.forEach(v => {
    const exists = template.includes(v)
    console.log(`  ${exists ? '✅' : '❌'} ${v}: ${exists ? 'Found' : 'MISSING'}`)
  })
  console.log()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('STEP 3: Build System Prompt (End-to-End)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const settings = {
    venice_api_key: 'test',
    venice_model: 'venice-uncensored'
  }

  const { phase, details } = await director.determinePhase(testContact.phone_whatsapp, agent.id)
  console.log(`Phase: ${phase}`)
  console.log(`Trust Score: ${details.trustScore}`)
  console.log()

  const systemPrompt = await director.buildSystemPrompt(
    settings,
    testContact,
    phase,
    details,
    'You are Lena, an 18-year-old girl from California.',
    agent.id,
    'VIP/Financial Relationship Established'
  )

  console.log('Checking if dynamic values are injected...')
  const dynamicValues = [
    { key: 'CURRENT_TIER', value: escalationState.currentTier.toString() },
    { key: 'TOTAL_PAYMENTS', value: escalationState.totalPayments.toString() },
    { key: 'TOTAL_RECEIVED', value: escalationState.totalReceived }
  ]

  let allInjected = true
  dynamicValues.forEach(({ key, value }) => {
    const found = systemPrompt.includes(value)
    console.log(`  ${found ? '✅' : '❌'} ${key} (${value}): ${found ? 'Injected' : 'NOT FOUND'}`)
    if (!found) allInjected = false
  })

  // For SUGGESTED_AMOUNT, check if any amount in expected tier range appears
  const tierConfig = escalationService.ESCALATION_TIERS[escalationState.currentTier]
  const amountMatch = systemPrompt.match(/Suggested amount: \$(\d+)/)
  if (amountMatch) {
    const injectedAmount = parseInt(amountMatch[1])
    const inRange = injectedAmount >= tierConfig.minAmount && injectedAmount <= tierConfig.maxAmount
    console.log(`  ${inRange ? '✅' : '❌'} SUGGESTED_AMOUNT ($${injectedAmount}): ${inRange ? `In range ($${tierConfig.minAmount}-$${tierConfig.maxAmount})` : 'OUT OF RANGE'}`)
    if (!inRange) allInjected = false
  } else {
    console.log(`  ❌ SUGGESTED_AMOUNT: NOT FOUND`)
    allInjected = false
  }
  console.log()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('STEP 4: Check Romantic Tone')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const romanticKeywords = [
    'FEELINGS',
    'miss u',
    'thinking about u',
    'babe',
    '💖',
    '😘',
    '🥺',
    'romantic'
  ]

  console.log('Romantic elements in prompt:')
  romanticKeywords.forEach(keyword => {
    const found = systemPrompt.toLowerCase().includes(keyword.toLowerCase())
    console.log(`  ${found ? '✅' : '⚪'} "${keyword}": ${found ? 'Present' : 'Not found'}`)
  })
  console.log()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('STEP 5: Sample Prompt Excerpt')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Find the Phase 4 section
  const phase4Start = systemPrompt.indexOf('**PHASE 4')
  if (phase4Start !== -1) {
    const excerpt = systemPrompt.substring(phase4Start, phase4Start + 600)
    console.log(excerpt)
    console.log('...\n')
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('VERIFICATION SUMMARY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const checks = {
    'Escalation Service': escalationState.currentTier === 2,
    'Template Variables': hasVariables.every(v => template.includes(v)),
    'Dynamic Injection': allInjected,
    'Romantic Tone': systemPrompt.toLowerCase().includes('feelings'),
    'Phase 4 Active': phase === 'MONEYPOT'
  }

  Object.entries(checks).forEach(([name, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${name}: ${passed ? 'PASS' : 'FAIL'}`)
  })

  const allPassed = Object.values(checks).every(v => v)
  console.log()
  console.log(allPassed
    ? '🎉 ALL CHECKS PASSED - Phase 4 Romantic + Escalation is READY FOR PRODUCTION!'
    : '⚠️  Some checks failed - review above')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Verification failed:', e)
    process.exit(1)
  })
