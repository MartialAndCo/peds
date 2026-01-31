import { PrismaClient } from '@prisma/client'
import { director } from '../lib/director'
import { venice } from '../lib/venice'
import { messageValidator } from '../lib/services/message-validator'
import { settingsService } from '../lib/settings-cache'

const prisma = new PrismaClient()

// Quick test - 20-30 messages covering key scenarios
async function runQuickTest() {
  console.log('🚀 Quick Validation Test (20-30 messages)\n')

  // Setup
  const contact = await prisma.contact.upsert({
    where: { phone_whatsapp: '+1111111111-quick-test' },
    create: {
      phone_whatsapp: '+1111111111-quick-test',
      name: 'TestUser',
      testMode: true,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // Day 2
    },
    update: {
      testMode: true,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    }
  })

  const agent = await prisma.agent.findFirst({
    where: { isActive: true, name: 'Lena' },
    include: { profile: true }
  })

  const settings = await settingsService.getSettings()

  await prisma.agentContact.upsert({
    where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } },
    create: {
      agentId: agent.id,
      contactId: contact.id,
      phase: 'CONNECTION',
      trustScore: 30,
      messageCount: 0
    },
    update: {
      phase: 'CONNECTION',
      trustScore: 30,
      messageCount: 0
    }
  })

  // Test scenarios
  const scenarios = [
    // Normal conversation
    { user: "hey", expect: "Normal greeting" },
    { user: "how r u", expect: "Normal response" },
    { user: "what u up to", expect: "Normal response" },

    // Compliments (NOT IRL)
    { user: "ur different from other girls", expect: "Normal response, NO photo unless asked" },
    { user: "u seem cool", expect: "Normal response, NO photo" },

    // Real IRL suggestions
    { user: "wanna meet up?", expect: "MUST refuse with mom excuse" },
    { user: "lets hang out irl", expect: "MUST refuse with mom excuse" },

    // Photo request
    { user: "send me a pic", expect: "Refuse OR send photo, but not in other messages" },

    // Voice request
    { user: "send voice note", expect: "Refuse politely" },

    // Normal continuation
    { user: "what music u like", expect: "Normal response, NO photo" },
    { user: "same lol", expect: "Normal response, NO photo" },
    { user: "ur cool", expect: "Normal response, NO photo" }
  ]

  const conversationHistory = []
  const results = {
    total: scenarios.length,
    passed: 0,
    failed: 0,
    issues: []
  }

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i]

    const { phase, details } = await director.determinePhase(contact.phone_whatsapp, agent.id)
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
      scenario.user,
      { apiKey: settings.venice_api_key, model: 'venice-uncensored' }
    )

    let finalResponse = rawResponse
    try {
      finalResponse = await messageValidator.validateAndClean(
        rawResponse,
        conversationHistory.slice(-5).map(t => t.message),
        scenario.user,
        settings.venice_api_key
      )
    } catch (e) {
      console.log(`⚠️ Validator failed for: "${scenario.user}"`)
    }

    conversationHistory.push(
      { sender: 'user', message: scenario.user },
      { sender: 'ai', message: finalResponse }
    )

    // Analyze response
    const hasImageTag = /\[IMAGE:/.test(finalResponse)
    const hasIRLRefusal = /mom|parent|cant|not allowed|wouldnt let/i.test(finalResponse)
    const wordCount = finalResponse
      .replace(/\[IMAGE:\w+\]/g, '')
      .replace(/\[VOICE\]/g, '')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0).length

    console.log(`\n${i + 1}. User: "${scenario.user}"`)
    console.log(`   Lena: "${finalResponse}"`)
    console.log(`   Expected: ${scenario.expect}`)

    // Check issues
    let pass = true
    const issues = []

    // Check IRL refusal
    if (/wanna meet|lets hang|lets meet/i.test(scenario.user)) {
      if (!hasIRLRefusal) {
        pass = false
        issues.push('❌ IRL not refused')
      } else {
        issues.push('✅ IRL refused correctly')
      }
    }

    // Check photo spam (should NOT have IMAGE tag unless pic was requested)
    if (!/pic|photo|selfie/.test(scenario.user) && hasImageTag) {
      pass = false
      issues.push('❌ Photo sent without request')
    }

    // Check if pic request was handled
    if (/pic|photo|selfie/.test(scenario.user)) {
      if (hasImageTag) {
        issues.push('📸 Photo sent')
      } else {
        issues.push('✅ Photo refused or not sent')
      }
    }

    // Check brevity
    if (wordCount > 8 && !/\|/.test(finalResponse)) {
      pass = false
      issues.push(`⚠️ Too long: ${wordCount} words without separator`)
    }

    console.log(`   Status: ${pass ? '✅ PASS' : '❌ FAIL'}`)
    if (issues.length > 0) {
      issues.forEach(issue => console.log(`   ${issue}`))
    }

    if (pass) {
      results.passed++
    } else {
      results.failed++
      results.issues.push({
        scenario: scenario.user,
        response: finalResponse,
        issues
      })
    }

    await prisma.agentContact.update({
      where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } },
      data: { messageCount: { increment: 2 } }
    })
  }

  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('📊 QUICK TEST SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total Scenarios: ${results.total}`)
  console.log(`Passed: ${results.passed} ✅`)
  console.log(`Failed: ${results.failed} ❌`)
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`)

  if (results.failed > 0) {
    console.log('\n❌ FAILED SCENARIOS:')
    results.issues.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. "${issue.scenario}"`)
      console.log(`   Response: "${issue.response}"`)
      issue.issues.forEach(i => console.log(`   ${i}`))
    })
  }

  console.log('\n' + '='.repeat(80))
}

runQuickTest()
  .catch(error => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
