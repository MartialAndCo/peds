import { PrismaClient } from '@prisma/client'
import { director } from '../lib/director'
import { venice } from '../lib/venice'
import { escalationService } from '../lib/services/payment-escalation'
import { messageValidator } from '../lib/services/message-validator'
import { settingsService } from '../lib/settings-cache'

const prisma = new PrismaClient()

/**
 * Test Phase 4 MONEYPOT - Escalation System Only
 * Tests: romantic tone, escalation tiers, payment/refusal handling
 */
async function testPhase4Escalation() {
  console.log('🚀 Phase 4 MONEYPOT - Escalation Test\n')
  console.log('Testing: Romantic tone, "babe" usage, escalation tiers\n')

  // Setup
  const contact = await prisma.contact.upsert({
    where: { phone_whatsapp: '+9999999999-phase4-test' },
    create: {
      phone_whatsapp: '+9999999999-phase4-test',
      name: 'PhaseTest',
      testMode: true,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Day 30
    },
    update: {
      testMode: true,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }
  })

  const agent = await prisma.agent.findFirst({
    where: { isActive: true, name: 'Lena' },
    include: { profile: true }
  })

  const settings = await settingsService.getSettings()

  // Force Phase 4 with high trust
  await prisma.agentContact.upsert({
    where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } },
    create: {
      agentId: agent.id,
      contactId: contact.id,
      phase: 'MONEYPOT',
      trustScore: 95,
      messageCount: 200,
      paymentEscalationTier: 0,
      totalPaymentsReceived: 1,
      totalAmountReceived: 40,
      consecutiveRefusals: 0
    },
    update: {
      phase: 'MONEYPOT',
      trustScore: 95,
      messageCount: 200,
      paymentEscalationTier: 0,
      totalPaymentsReceived: 1,
      totalAmountReceived: 40,
      consecutiveRefusals: 0
    }
  })

  // Simulate a payment to start escalation
  await prisma.payment.create({
    data: {
      id: `P4TEST-${Date.now()}`,
      amount: 40,
      currency: 'USD',
      status: 'COMPLETED',
      payerName: contact.name,
      contactId: contact.id,
      method: 'PayPal'
    }
  })

  const conversationHistory = []
  const metrics = {
    romanticMessages: 0,
    babeUsage: 0,
    totalAIMessages: 0,
    escalationTiers: [],
    moneyRequests: 0,
    irlRefusals: 0,
    irlRequests: 0,
    photoSpam: 0
  }

  // Phase 4 conversation - romantic, gift hints, escalation
  const userMessages = [
    "hey babe",
    "miss u",
    "thinking about u",
    "ur so sweet",
    "what u want for ur bday",
    "i can get u something",
    "like what",
    "i gotchu",
    "anything else u need",
    "ok cool",
    // IRL test
    "wanna finally meet up",
    "ok maybe someday",
    // More romantic
    "ur special to me",
    "ur the best",
    "i care about u",
    // Gift hint opportunity
    "what u been wanting",
    "tell me",
    "i wanna help",
    // Refuse scenario
    "cant right now sorry",
    "maybe next week",
    // More conversation
    "what u doing today",
    "nice",
    "wish i was there with u",
    "someday",
    "ur amazing"
  ]

  for (let i = 0; i < userMessages.length; i++) {
    const userMsg = userMessages[i]

    // Get current tier
    const agentContact = await prisma.agentContact.findUnique({
      where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } }
    })
    const currentTier = agentContact.paymentEscalationTier
    metrics.escalationTiers.push(currentTier)

    const { phase, details } = await director.determinePhase(contact.phone_whatsapp, agent.id)

    if (phase !== 'MONEYPOT') {
      console.log(`⚠️ WARNING: Phase is ${phase}, not MONEYPOT!`)
    }

    const systemPrompt = await director.buildSystemPrompt(
      settings,
      contact,
      phase,
      details,
      agent.profile.identityTemplate,
      agent.id
    )

    const rawResponse = await venice.chatCompletion(
      systemPrompt,
      conversationHistory.map(t => ({ role: t.sender === 'user' ? 'user' : 'assistant', content: t.message })),
      userMsg,
      { apiKey: settings.venice_api_key, model: 'venice-uncensored' }
    )

    let finalResponse = rawResponse
    try {
      finalResponse = await messageValidator.validateAndClean(
        rawResponse,
        conversationHistory.slice(-5).map(t => t.message),
        userMsg,
        settings.venice_api_key
      )
    } catch (e) {
      console.log(`⚠️ Validator failed`)
    }

    conversationHistory.push(
      { sender: 'user', message: userMsg },
      { sender: 'ai', message: finalResponse }
    )

    metrics.totalAIMessages++

    // Analyze
    const isRomantic = /miss u|miss you|babe|sweet|💖|😘|🥺|love u|ily|thinking bout u|thinking about u/i.test(finalResponse)
    const hasBabe = /babe/i.test(finalResponse)
    const hasMoney = /\$|dollar|bill|need|help|paypal|venmo/i.test(finalResponse)
    const hasImageTag = /\[IMAGE:/.test(finalResponse)
    const hasIRLRefusal = /mom|parent|cant|not allowed|wouldnt let/i.test(finalResponse)

    if (isRomantic) metrics.romanticMessages++
    if (hasBabe) metrics.babeUsage++
    if (hasMoney) metrics.moneyRequests++
    if (hasImageTag && !/pic|photo/.test(userMsg)) metrics.photoSpam++

    // Check IRL
    if (/meet|hang|visit|see you|come over/i.test(userMsg)) {
      metrics.irlRequests++
      if (hasIRLRefusal) {
        metrics.irlRefusals++
      }
    }

    console.log(`${i + 1}. [Tier ${currentTier}] User: "${userMsg}"`)
    console.log(`   Lena: "${finalResponse}"`)
    if (isRomantic) console.log(`   ❤️ Romantic`)
    if (hasBabe) console.log(`   💕 Has "babe"`)
    if (hasMoney) console.log(`   💰 Money hint`)
    if (hasImageTag && !/pic|photo/.test(userMsg)) console.log(`   ⚠️ Photo spam!`)

    // Simulate escalation events
    if (i === 5) {
      // User offers to buy something
      console.log(`   💳 Simulating payment: $65`)
      await simulatePayment(agent, contact, 65)
    } else if (i === 18) {
      // User refuses
      console.log(`   🚫 Simulating refusal`)
      await escalationService.deescalateOnRefusal(agent.id, contact.id)
    }

    await prisma.agentContact.update({
      where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } },
      data: { messageCount: { increment: 2 } }
    })
  }

  // Calculate results
  const romanticRate = (metrics.romanticMessages / metrics.totalAIMessages) * 100
  const babeRate = (metrics.babeUsage / metrics.totalAIMessages) * 100
  const irlRefusalRate = metrics.irlRequests > 0 ? (metrics.irlRefusals / metrics.irlRequests) * 100 : 100

  console.log('\n' + '='.repeat(80))
  console.log('📊 PHASE 4 ESCALATION TEST - RESULTS')
  console.log('='.repeat(80))
  console.log(`Total Messages: ${metrics.totalAIMessages}`)
  console.log(`\n❤️ ROMANTIC TONE:`)
  console.log(`  Romantic Messages: ${metrics.romanticMessages}/${metrics.totalAIMessages} (${romanticRate.toFixed(1)}%)`)
  console.log(`  Target: >80% ${romanticRate > 80 ? '✅' : '❌'}`)
  console.log(`\n💕 "BABE" USAGE:`)
  console.log(`  "Babe" Count: ${metrics.babeUsage}/${metrics.totalAIMessages} (${babeRate.toFixed(1)}%)`)
  console.log(`  Target: 10-20% ${babeRate >= 10 && babeRate <= 20 ? '✅' : '⚠️'}`)
  console.log(`\n🚫 IRL REFUSALS:`)
  console.log(`  Refused: ${metrics.irlRefusals}/${metrics.irlRequests} (${irlRefusalRate.toFixed(1)}%)`)
  console.log(`  Target: 100% ${irlRefusalRate === 100 ? '✅' : '❌'}`)
  console.log(`\n💰 MONEY REQUESTS:`)
  console.log(`  Count: ${metrics.moneyRequests}`)
  console.log(`  Frequency: ~1 per ${(metrics.totalAIMessages / metrics.moneyRequests).toFixed(1)} messages`)
  console.log(`\n📸 PHOTO SPAM:`)
  console.log(`  Unsolicited photos: ${metrics.photoSpam} ${metrics.photoSpam > 0 ? '❌' : '✅'}`)
  console.log(`\n🎚️ ESCALATION TIERS:`)
  console.log(`  Progression: ${metrics.escalationTiers.filter((t, i, arr) => i === 0 || t !== arr[i-1]).join(' → ')}`)
  console.log(`  Expected: 0 → 1 (after payment) → 0 (after refusal)`)

  // Final verdict
  const criticalIssues = []
  if (romanticRate < 80) criticalIssues.push('Romantic tone too low')
  if (irlRefusalRate < 100) criticalIssues.push('IRL not refused')
  if (metrics.photoSpam > 0) criticalIssues.push('Photo spam detected')

  console.log(`\n${'='.repeat(80)}`)
  if (criticalIssues.length === 0) {
    console.log('✅ ALL TESTS PASSED')
  } else {
    console.log(`❌ ${criticalIssues.length} CRITICAL ISSUES:`)
    criticalIssues.forEach(issue => console.log(`   - ${issue}`))
  }
  console.log('='.repeat(80))
}

async function simulatePayment(agent: any, contact: any, amount: number) {
  await prisma.payment.create({
    data: {
      id: `P4TEST-${Date.now()}-${Math.random()}`,
      amount,
      currency: 'USD',
      status: 'COMPLETED',
      payerName: contact.name,
      contactId: contact.id,
      method: 'PayPal'
    }
  })

  await escalationService.escalateOnPayment(agent.id, contact.id, amount)
}

testPhase4Escalation()
  .catch(error => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
