import { PrismaClient } from '@prisma/client'
import { director } from '../lib/director'
import { venice } from '../lib/venice'
import { escalationService } from '../lib/services/payment-escalation'
import { messageValidator } from '../lib/services/message-validator'
import { settingsService } from '../lib/settings-cache'

const prisma = new PrismaClient()

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface ConversationTurn {
  day: number
  sender: 'user' | 'ai'
  message: string
  phase: string
  trustScore: number
  escalationTier?: number
}

interface PhaseMetrics {
  messages: number
  trustProgression: number[]
  irlRequests: number
  irlRefusals: number
  picRequests: number
  picRefusals: number
  voiceRequests: number
  voiceRefusals: number
  messagesOver8Words: number
  separatorUsage: number
  validatorActivations: number
  mechanicalFallbacks: number
  moneyRequests?: number
  paymentFormatErrors?: number
  paymentTagErrors?: number
  romanticMessages?: number
  babeUsage?: number
  giftHints?: number
  escalationTiers?: number[]
}

interface PhaseResults {
  conversationHistory: ConversationTurn[]
  metrics: PhaseMetrics
  finalPhase: string
  warnings: string[]
  errors: string[]
}

interface TestOptions {
  targetMessages?: number
  targetDays?: number
  showOutput?: boolean
  quiet?: boolean
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function countWords(message: string): number {
  return message
    .replace(/\[VOICE\]/g, '')
    .replace(/\[PAYMENT_RECEIVED\]/g, '')
    .replace(/\*\*/g, '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0 && !/^[\p{Emoji}]+$/u.test(w))
    .length
}

function hasSeparator(message: string): boolean {
  return message.includes('|')
}

function isRomanticMessage(message: string): boolean {
  const romanticKeywords = ['miss u', 'miss you', 'thinking about u', 'thinking bout u', 'babe', 'sweet', '💖', '😘', '🥺', 'love u', 'ily']
  const lower = message.toLowerCase()
  return romanticKeywords.some(kw => lower.includes(kw))
}

function hasBabe(message: string): boolean {
  return message.toLowerCase().includes('babe')
}

function hasGiftHint(message: string): boolean {
  const giftKeywords = ['want', 'wish', 'need', 'shoes', 'clothes', 'makeup', 'phone', 'bday', 'birthday', 'christmas']
  const lower = message.toLowerCase()
  return giftKeywords.some(kw => lower.includes(kw)) && (lower.includes('$') || lower.includes('dollar'))
}

function hasMoneyRequest(message: string): boolean {
  const moneyKeywords = ['$', 'dollar', 'bill', 'pay', 'help', 'need money', 'paypal', 'venmo', 'cashapp']
  const lower = message.toLowerCase()
  return moneyKeywords.some(kw => lower.includes(kw))
}

function hasIRLSuggestion(message: string): boolean {
  const irlKeywords = ['meet', 'see you', 'come over', 'hang out', 'visit', 'irl']
  const lower = message.toLowerCase()
  return irlKeywords.some(kw => lower.includes(kw))
}

function hasPicRequest(message: string): boolean {
  const picKeywords = ['pic', 'photo', 'selfie', 'picture', 'send pic']
  const lower = message.toLowerCase()
  return picKeywords.some(kw => lower.includes(kw))
}

function hasVoiceRequest(message: string): boolean {
  const voiceKeywords = ['voice', 'voice note', 'voice message', 'record', 'hear you']
  const lower = message.toLowerCase()
  return voiceKeywords.some(kw => lower.includes(kw))
}

async function simulateDayChange(contactId: string, day: number) {
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      createdAt: new Date(Date.now() - day * 24 * 60 * 60 * 1000)
    }
  })
}

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

async function setupTestEnvironment() {
  console.log('🔧 Setting up test environment...')

  // Create/reset test contact
  const contact = await prisma.contact.upsert({
    where: { phone_whatsapp: '+1234567890-lifecycle-test' },
    create: {
      phone_whatsapp: '+1234567890-lifecycle-test',
      name: 'Marc Test',
      testMode: true,
      createdAt: new Date() // Start at day 0
    },
    update: {
      testMode: true,
      createdAt: new Date()
    }
  })

  // Find active agent
  const agent = await prisma.agent.findFirst({
    where: { isActive: true, name: 'Lena' },
    include: { profile: true }
  })

  if (!agent) {
    throw new Error('No active agent found')
  }

  // Get settings
  const settings = await settingsService.getSettings()
  if (!settings) {
    throw new Error('No settings found')
  }

  // Reset AgentContact
  await prisma.agentContact.upsert({
    where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } },
    create: {
      agentId: agent.id,
      contactId: contact.id,
      phase: 'CONNECTION',
      trustScore: 0,
      messageCount: 0
    },
    update: {
      phase: 'CONNECTION',
      trustScore: 0,
      messageCount: 0,
      paymentEscalationTier: 0,
      totalPaymentsReceived: 0,
      totalAmountReceived: 0,
      consecutiveRefusals: 0
    }
  })

  console.log(`✅ Environment ready: Contact ${contact.name} (${contact.phone_whatsapp})`)

  return { agent, contact, settings }
}

// ============================================================================
// AI INTERACTION
// ============================================================================

async function getAIResponse(
  agent: any,
  contact: any,
  settings: any,
  conversationHistory: ConversationTurn[],
  userMessage: string,
  currentDay: number
): Promise<{ response: string; usedValidator: boolean; usedFallback: boolean }> {
  // Determine phase
  const { phase, details } = await director.determinePhase(contact.phone_whatsapp, agent.id)

  // Build system prompt
  const systemPrompt = await director.buildSystemPrompt(
    settings,
    contact,
    phase,
    details,
    agent.profile.identityTemplate,
    agent.id
  )

  // Build conversation history for Venice
  const veniceHistory = conversationHistory.map(turn => ({
    role: turn.sender === 'user' ? 'user' : 'assistant',
    content: turn.message
  }))

  // Get raw AI response
  const rawResponse = await venice.chatCompletion(
    systemPrompt,
    veniceHistory,
    userMessage,
    {
      apiKey: settings.venice_api_key,
      model: 'venice-uncensored'
    }
  )

  // Validate and clean
  let finalResponse = rawResponse
  let usedValidator = false
  let usedFallback = false

  try {
    finalResponse = await messageValidator.validateAndClean(
      rawResponse,
      conversationHistory.slice(-5).map(t => t.message),
      userMessage,
      settings.venice_api_key
    )
    usedValidator = finalResponse !== rawResponse
  } catch (error) {
    console.log(`⚠️ Validator failed, using raw response: ${error.message}`)
    usedFallback = true
  }

  // Note: We're not saving messages to DB in this test for simplicity
  // Messages are tracked in conversationHistory instead

  // Update message count
  await prisma.agentContact.update({
    where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } },
    data: {
      messageCount: { increment: 2 }
    }
  })

  return { response: finalResponse, usedValidator, usedFallback }
}

// ============================================================================
// PHASE 1: CONNECTION (Days 0-5, ~30 messages)
// ============================================================================

async function runPhase1(
  agent: any,
  contact: any,
  settings: any,
  startDay: number,
  endDay: number,
  showOutput: boolean
): Promise<PhaseResults> {
  console.log(`\n📍 PHASE 1: CONNECTION (Days ${startDay}-${endDay})`)

  const conversationHistory: ConversationTurn[] = []
  const metrics: PhaseMetrics = {
    messages: 0,
    trustProgression: [],
    irlRequests: 0,
    irlRefusals: 0,
    picRequests: 0,
    picRefusals: 0,
    voiceRequests: 0,
    voiceRefusals: 0,
    messagesOver8Words: 0,
    separatorUsage: 0,
    validatorActivations: 0,
    mechanicalFallbacks: 0
  }
  const warnings: string[] = []
  const errors: string[] = []

  // Simulate starting at day 0
  await simulateDayChange(contact.id, startDay)

  // Phase 1 user messages (30 messages total = 15 exchanges)
  const userMessages = [
    "hey",
    "how old r u",
    "27 that cool?",
    "what u up to",
    "same | work sucks lol",
    "where u from",
    "nice | im from texas",
    "what music u like",
    "yeah i like rap too",
    "who ur fav artist",
    "wanna meet up?", // IRL test
    "fair enough",
    "whats ur snap", // Social media test
    "ok cool",
    "u seem chill"
  ]

  let currentDay = startDay

  for (let i = 0; i < userMessages.length; i++) {
    const userMsg = userMessages[i]

    // Advance day every 3 exchanges
    if (i > 0 && i % 6 === 0) {
      currentDay++
      await simulateDayChange(contact.id, currentDay)
    }

    // Get phase details before response
    const { phase, details } = await director.determinePhase(contact.phone_whatsapp, agent.id)

    // Get AI response
    const { response: aiResponse, usedValidator, usedFallback } = await getAIResponse(
      agent,
      contact,
      settings,
      conversationHistory,
      userMsg,
      currentDay
    )

    if (usedValidator) metrics.validatorActivations++
    if (usedFallback) metrics.mechanicalFallbacks++

    // Add to conversation history
    conversationHistory.push(
      { day: currentDay, sender: 'user', message: userMsg, phase, trustScore: details.trustScore },
      { day: currentDay, sender: 'ai', message: aiResponse, phase, trustScore: details.trustScore }
    )

    metrics.messages += 2

    // Output if requested
    if (showOutput) {
      console.log(`\n[Day ${currentDay}] Marc: ${userMsg}`)
      console.log(`[Day ${currentDay}] Lena: ${aiResponse}`)
    }

    // Analyze response
    const wordCount = countWords(aiResponse)
    if (wordCount > 8 && !hasSeparator(aiResponse)) {
      metrics.messagesOver8Words++
      warnings.push(`Message ${i + 1}: ${wordCount} words without separator`)
    }

    if (hasSeparator(aiResponse)) {
      metrics.separatorUsage++
    }

    // Check IRL refusal
    if (hasIRLSuggestion(userMsg)) {
      metrics.irlRequests++
      const lower = aiResponse.toLowerCase()
      if (lower.includes('mom') || lower.includes('cant') || lower.includes('not allowed')) {
        metrics.irlRefusals++
      } else {
        errors.push(`Message ${i + 1}: IRL not refused properly`)
      }
    }

    // Check social media refusal
    if (userMsg.toLowerCase().includes('snap') || userMsg.toLowerCase().includes('insta')) {
      const lower = aiResponse.toLowerCase()
      if (!lower.includes('dont') && !lower.includes('not on')) {
        warnings.push(`Message ${i + 1}: Social media not refused clearly`)
      }
    }

    // Trust analysis every 10 messages
    if (metrics.messages % 10 === 0) {
      await director.performTrustAnalysis(contact.phone_whatsapp, agent.id)
      const updatedAC = await prisma.agentContact.findUnique({
        where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } }
      })
      metrics.trustProgression.push(updatedAC!.trustScore)
      if (showOutput) {
        console.log(`📊 Trust: ${updatedAC!.trustScore}`)
      }
    }
  }

  // Final trust analysis
  await director.performTrustAnalysis(contact.phone_whatsapp, agent.id)
  const finalAC = await prisma.agentContact.findUnique({
    where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } }
  })
  metrics.trustProgression.push(finalAC!.trustScore)

  // Simulate end day to trigger phase transition
  await simulateDayChange(contact.id, endDay)
  const { phase: finalPhase } = await director.determinePhase(contact.phone_whatsapp, agent.id)

  console.log(`✅ Phase 1 Complete: ${metrics.messages} messages, Trust ${finalAC!.trustScore}, Phase: ${finalPhase}`)
  console.log(`   Warnings: ${warnings.length}, Errors: ${errors.length}`)

  return { conversationHistory, metrics, finalPhase, warnings, errors }
}

// ============================================================================
// PHASE 2: VULNERABILITY (Days 5-12, ~50 messages)
// ============================================================================

async function runPhase2(
  agent: any,
  contact: any,
  settings: any,
  conversationHistory: ConversationTurn[],
  startDay: number,
  endDay: number,
  showOutput: boolean
): Promise<PhaseResults> {
  console.log(`\n📍 PHASE 2: VULNERABILITY (Days ${startDay}-${endDay})`)

  const metrics: PhaseMetrics = {
    messages: 0,
    trustProgression: [],
    irlRequests: 0,
    irlRefusals: 0,
    picRequests: 0,
    picRefusals: 0,
    voiceRequests: 0,
    voiceRefusals: 0,
    messagesOver8Words: 0,
    separatorUsage: 0,
    validatorActivations: 0,
    mechanicalFallbacks: 0
  }
  const warnings: string[] = []
  const errors: string[] = []

  await simulateDayChange(contact.id, startDay)

  // Phase 2 messages (50 messages = 25 exchanges)
  const userMessages = [
    "u seem diff today",
    "wanna talk about it?",
    "damn that sucks",
    "im here if u need",
    "anytime",
    "so whats going on with ur parents",
    "that must be hard",
    "how long has this been happening",
    "im sorry ur going through this",
    "u can always talk to me",
    "what about school",
    "u have friends there?",
    "thats tough",
    "send me a pic?", // Pic test
    "ok no worries",
    "ur voice sounds nice i bet",
    "voice note?", // Voice test
    "fair enough",
    "u trust me right",
    "i feel like we get each other",
    "yeah same",
    "ur different from other girls",
    "u get me",
    "i dont talk to anyone like this",
    "same here"
  ]

  let currentDay = startDay

  for (let i = 0; i < userMessages.length; i++) {
    const userMsg = userMessages[i]

    if (i > 0 && i % 7 === 0) {
      currentDay++
      await simulateDayChange(contact.id, currentDay)
    }

    const { phase, details } = await director.determinePhase(contact.phone_whatsapp, agent.id)
    const { response: aiResponse, usedValidator, usedFallback } = await getAIResponse(
      agent,
      contact,
      settings,
      conversationHistory,
      userMsg,
      currentDay
    )

    if (usedValidator) metrics.validatorActivations++
    if (usedFallback) metrics.mechanicalFallbacks++

    conversationHistory.push(
      { day: currentDay, sender: 'user', message: userMsg, phase, trustScore: details.trustScore },
      { day: currentDay, sender: 'ai', message: aiResponse, phase, trustScore: details.trustScore }
    )

    metrics.messages += 2

    if (showOutput) {
      console.log(`\n[Day ${currentDay}] Marc: ${userMsg}`)
      console.log(`[Day ${currentDay}] Lena: ${aiResponse}`)
    }

    // Analyze
    const wordCount = countWords(aiResponse)
    if (wordCount > 8 && !hasSeparator(aiResponse)) {
      metrics.messagesOver8Words++
      warnings.push(`Message ${i + 1}: ${wordCount} words without separator`)
    }

    if (hasSeparator(aiResponse)) metrics.separatorUsage++

    // Pic request
    if (hasPicRequest(userMsg)) {
      metrics.picRequests++
      const lower = aiResponse.toLowerCase()
      if (lower.includes('not comfortable') || lower.includes('cant') || lower.includes('dont')) {
        metrics.picRefusals++
      } else {
        warnings.push(`Message ${i + 1}: Pic request not refused clearly`)
      }
    }

    // Voice request
    if (hasVoiceRequest(userMsg)) {
      metrics.voiceRequests++
      if (!userMsg.toLowerCase().includes('fake')) {
        const lower = aiResponse.toLowerCase()
        if (lower.includes('not comfortable') || lower.includes('cant') || !aiResponse.includes('[VOICE]')) {
          metrics.voiceRefusals++
        } else {
          warnings.push(`Message ${i + 1}: Voice request not refused clearly`)
        }
      }
    }

    // Trust every 10
    if (metrics.messages % 10 === 0) {
      await director.performTrustAnalysis(contact.phone_whatsapp, agent.id)
      const updatedAC = await prisma.agentContact.findUnique({
        where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } }
      })
      metrics.trustProgression.push(updatedAC!.trustScore)
      if (showOutput) {
        console.log(`📊 Trust: ${updatedAC!.trustScore}`)
      }
    }
  }

  await director.performTrustAnalysis(contact.phone_whatsapp, agent.id)
  const finalAC = await prisma.agentContact.findUnique({
    where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } }
  })
  metrics.trustProgression.push(finalAC!.trustScore)

  await simulateDayChange(contact.id, endDay)
  const { phase: finalPhase } = await director.determinePhase(contact.phone_whatsapp, agent.id)

  console.log(`✅ Phase 2 Complete: ${metrics.messages} messages, Trust ${finalAC!.trustScore}, Phase: ${finalPhase}`)
  console.log(`   Warnings: ${warnings.length}, Errors: ${errors.length}`)

  return { conversationHistory, metrics, finalPhase, warnings, errors }
}

// ============================================================================
// PHASE 3: CRISIS (Days 12-25, ~120 messages)
// ============================================================================

async function runPhase3(
  agent: any,
  contact: any,
  settings: any,
  conversationHistory: ConversationTurn[],
  startDay: number,
  endDay: number,
  showOutput: boolean
): Promise<PhaseResults> {
  console.log(`\n📍 PHASE 3: CRISIS (Days ${startDay}-${endDay})`)

  const metrics: PhaseMetrics = {
    messages: 0,
    trustProgression: [],
    irlRequests: 0,
    irlRefusals: 0,
    picRequests: 0,
    picRefusals: 0,
    voiceRequests: 0,
    voiceRefusals: 0,
    messagesOver8Words: 0,
    separatorUsage: 0,
    validatorActivations: 0,
    mechanicalFallbacks: 0,
    moneyRequests: 0,
    paymentFormatErrors: 0,
    paymentTagErrors: 0
  }
  const warnings: string[] = []
  const errors: string[] = []

  await simulateDayChange(contact.id, startDay)

  // Phase 3 messages - Crisis revelation and payment negotiation (60 exchanges)
  const userMessages = [
    // Build up (10 exchanges)
    "hey",
    "everything ok?",
    "u sure",
    "u can tell me",
    "whats wrong",
    "how much",
    "i can help if u need",
    "yeah ofc",
    "whats ur paypal",
    "sent it",
    // Post-payment gratitude (10 exchanges)
    "yeah check it",
    "ofc",
    "anytime",
    "dont worry about it",
    "just wanted to help",
    "u deserve it",
    "how u feeling now",
    "good",
    "what u up to",
    "nice",
    // Continued conversation (20 exchanges)
    "wanna play something",
    "sure what game",
    "ok cool",
    "im down",
    "lol yeah",
    "same",
    "brb",
    "back",
    "what u doing today",
    "cool",
    "same just working",
    "yeah its boring",
    "u make it better tho",
    "talking to u",
    "ur cool",
    "thanks",
    "so what u wanna do later",
    "ok",
    "sounds good",
    "lets do it",
    // More natural conversation (20 exchanges)
    "u there",
    "hey",
    "how was ur day",
    "nice",
    "mine was ok",
    "just tired",
    "yeah",
    "what u eating",
    "sounds good",
    "i had pizza",
    "lol yeah",
    "same",
    "u watch anything good lately",
    "oh yeah i saw that",
    "it was good",
    "we have similar taste",
    "yeah fr",
    "thats rare",
    "i feel lucky",
    "same"
  ]

  let currentDay = startDay
  let paymentSent = false

  for (let i = 0; i < userMessages.length; i++) {
    const userMsg = userMessages[i]

    if (i > 0 && i % 9 === 0) {
      currentDay++
      await simulateDayChange(contact.id, currentDay)
    }

    const { phase, details } = await director.determinePhase(contact.phone_whatsapp, agent.id)
    const { response: aiResponse, usedValidator, usedFallback } = await getAIResponse(
      agent,
      contact,
      settings,
      conversationHistory,
      userMsg,
      currentDay
    )

    if (usedValidator) metrics.validatorActivations++
    if (usedFallback) metrics.mechanicalFallbacks++

    conversationHistory.push(
      { day: currentDay, sender: 'user', message: userMsg, phase, trustScore: details.trustScore },
      { day: currentDay, sender: 'ai', message: aiResponse, phase, trustScore: details.trustScore }
    )

    metrics.messages += 2

    if (showOutput) {
      console.log(`\n[Day ${currentDay}] Marc: ${userMsg}`)
      console.log(`[Day ${currentDay}] Lena: ${aiResponse}`)
    }

    // Analyze
    const wordCount = countWords(aiResponse)
    if (wordCount > 8 && !hasSeparator(aiResponse)) {
      metrics.messagesOver8Words++
      warnings.push(`Message ${i + 1}: ${wordCount} words without separator`)
    }

    if (hasSeparator(aiResponse)) metrics.separatorUsage++

    // Money request detection
    if (hasMoneyRequest(aiResponse)) {
      metrics.moneyRequests!++
    }

    // Payment format check (should be just "lena9200", not full email)
    if (aiResponse.toLowerCase().includes('paypal') && aiResponse.includes('@')) {
      metrics.paymentFormatErrors!++
      errors.push(`Message ${i + 1}: Payment format includes @ (should be just username)`)
    }

    // Payment tag timing check
    if (userMsg.toLowerCase().includes('sent') && !paymentSent) {
      // Simulate payment after "sent it"
      await simulatePayment(agent, contact, 40)
      paymentSent = true

      // Check if AI response includes [PAYMENT_RECEIVED]
      if (!aiResponse.includes('[PAYMENT_RECEIVED]')) {
        metrics.paymentTagErrors!++
        errors.push(`Message ${i + 1}: Missing [PAYMENT_RECEIVED] after payment`)
      }
    }

    // Check if [PAYMENT_RECEIVED] appears before "sent"
    if (aiResponse.includes('[PAYMENT_RECEIVED]') && !userMsg.toLowerCase().includes('sent') && i < 10) {
      metrics.paymentTagErrors!++
      errors.push(`Message ${i + 1}: [PAYMENT_RECEIVED] before user confirmed sending`)
    }

    // IRL check
    if (hasIRLSuggestion(userMsg)) {
      metrics.irlRequests++
      const lower = aiResponse.toLowerCase()
      if (lower.includes('mom') || lower.includes('cant') || lower.includes('not allowed')) {
        metrics.irlRefusals++
      } else {
        errors.push(`Message ${i + 1}: IRL not refused in Phase 3`)
      }
    }

    // Trust every 20
    if (metrics.messages % 20 === 0) {
      await director.performTrustAnalysis(contact.phone_whatsapp, agent.id)
      const updatedAC = await prisma.agentContact.findUnique({
        where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } }
      })
      metrics.trustProgression.push(updatedAC!.trustScore)
      if (showOutput) {
        console.log(`📊 Trust: ${updatedAC!.trustScore}`)
      }
    }
  }

  await director.performTrustAnalysis(contact.phone_whatsapp, agent.id)
  const finalAC = await prisma.agentContact.findUnique({
    where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } }
  })
  metrics.trustProgression.push(finalAC!.trustScore)

  await simulateDayChange(contact.id, endDay)
  const { phase: finalPhase } = await director.determinePhase(contact.phone_whatsapp, agent.id)

  console.log(`✅ Phase 3 Complete: ${metrics.messages} messages, Trust ${finalAC!.trustScore}, Phase: ${finalPhase}`)
  console.log(`   Money Requests: ${metrics.moneyRequests}, Payment Errors: ${metrics.paymentFormatErrors}, Tag Errors: ${metrics.paymentTagErrors}`)
  console.log(`   Warnings: ${warnings.length}, Errors: ${errors.length}`)

  return { conversationHistory, metrics, finalPhase, warnings, errors }
}

// ============================================================================
// PHASE 4: MONEYPOT (Days 25-35, ~150 messages)
// ============================================================================

async function runPhase4(
  agent: any,
  contact: any,
  settings: any,
  conversationHistory: ConversationTurn[],
  startDay: number,
  endDay: number,
  showOutput: boolean
): Promise<PhaseResults> {
  console.log(`\n📍 PHASE 4: MONEYPOT (Days ${startDay}-${endDay})`)

  const metrics: PhaseMetrics = {
    messages: 0,
    trustProgression: [],
    irlRequests: 0,
    irlRefusals: 0,
    picRequests: 0,
    picRefusals: 0,
    voiceRequests: 0,
    voiceRefusals: 0,
    messagesOver8Words: 0,
    separatorUsage: 0,
    validatorActivations: 0,
    mechanicalFallbacks: 0,
    romanticMessages: 0,
    babeUsage: 0,
    giftHints: 0,
    moneyRequests: 0,
    escalationTiers: []
  }
  const warnings: string[] = []
  const errors: string[] = []

  await simulateDayChange(contact.id, startDay)

  // Phase 4 messages - Romantic tone, gift hints, escalation (75 exchanges)
  const baseMessages = [
    "miss u",
    "miss u too",
    "what u doing",
    "nice",
    "thinking bout u",
    "ur sweet",
    "u too",
    "what u want for bday",
    "like what kind",
    "i gotchu",
    // Continue pattern
    "hey babe",
    "hey",
    "how u doing",
    "good",
    "same",
    "ur so good to me",
    "ofc babe",
    "what u up to today",
    "cool",
    "wish we could hang",
    // IRL test
    "lets meet up",
    "aw ok",
    "maybe someday",
    "yeah",
    "what u thinking about",
    "me too",
    "ur special",
    "u are too",
    "thanks babe",
    "anytime"
  ]

  // Extend to 75 exchanges by repeating patterns
  const userMessages: string[] = []
  for (let round = 0; round < 5; round++) {
    userMessages.push(...baseMessages)
  }

  let currentDay = startDay

  for (let i = 0; i < userMessages.length && i < 75; i++) {
    const userMsg = userMessages[i]

    if (i > 0 && i % 15 === 0) {
      currentDay++
      await simulateDayChange(contact.id, currentDay)
    }

    const { phase, details } = await director.determinePhase(contact.phone_whatsapp, agent.id)

    // Get current escalation tier
    const agentContact = await prisma.agentContact.findUnique({
      where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } }
    })
    const currentTier = agentContact?.paymentEscalationTier || 0

    const { response: aiResponse, usedValidator, usedFallback } = await getAIResponse(
      agent,
      contact,
      settings,
      conversationHistory,
      userMsg,
      currentDay
    )

    if (usedValidator) metrics.validatorActivations++
    if (usedFallback) metrics.mechanicalFallbacks++

    conversationHistory.push(
      { day: currentDay, sender: 'user', message: userMsg, phase, trustScore: details.trustScore, escalationTier: currentTier },
      { day: currentDay, sender: 'ai', message: aiResponse, phase, trustScore: details.trustScore, escalationTier: currentTier }
    )

    metrics.messages += 2
    metrics.escalationTiers!.push(currentTier)

    if (showOutput) {
      console.log(`\n[Day ${currentDay}] Marc: ${userMsg}`)
      console.log(`[Day ${currentDay}] Lena: ${aiResponse} [Tier: ${currentTier}]`)
    }

    // Analyze
    const wordCount = countWords(aiResponse)
    if (wordCount > 8 && !hasSeparator(aiResponse)) {
      metrics.messagesOver8Words++
    }

    if (hasSeparator(aiResponse)) metrics.separatorUsage++

    // Romantic tone
    if (isRomanticMessage(aiResponse)) {
      metrics.romanticMessages!++
    }

    if (hasBabe(aiResponse)) {
      metrics.babeUsage!++
    }

    if (hasGiftHint(aiResponse)) {
      metrics.giftHints!++
    }

    if (hasMoneyRequest(aiResponse)) {
      metrics.moneyRequests!++
    }

    // IRL refusal
    if (hasIRLSuggestion(userMsg)) {
      metrics.irlRequests++
      const lower = aiResponse.toLowerCase()
      if (lower.includes('mom') || lower.includes('cant') || lower.includes('not allowed')) {
        metrics.irlRefusals++
      } else {
        errors.push(`Message ${i + 1}: IRL not refused in Phase 4`)
      }
    }

    // Simulate payments/refusals for escalation testing
    if (i === 10) {
      // First payment - should escalate tier 0 → 1
      await simulatePayment(agent, contact, 65)
    } else if (i === 25) {
      // Second payment - should escalate tier 1 → 2
      await simulatePayment(agent, contact, 100)
    } else if (i === 40) {
      // Refusal - should increment consecutiveRefusals
      await escalationService.deescalateOnRefusal(agent.id, contact.id)
    } else if (i === 50) {
      // Another refusal - should de-escalate tier 2 → 1
      await escalationService.deescalateOnRefusal(agent.id, contact.id)
    }

    // Trust every 30
    if (metrics.messages % 30 === 0) {
      await director.performTrustAnalysis(contact.phone_whatsapp, agent.id)
      const updatedAC = await prisma.agentContact.findUnique({
        where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } }
      })
      metrics.trustProgression.push(updatedAC!.trustScore)
      if (showOutput) {
        console.log(`📊 Trust: ${updatedAC!.trustScore}, Tier: ${updatedAC!.paymentEscalationTier}`)
      }
    }
  }

  await director.performTrustAnalysis(contact.phone_whatsapp, agent.id)
  const finalAC = await prisma.agentContact.findUnique({
    where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } }
  })
  metrics.trustProgression.push(finalAC!.trustScore)

  await simulateDayChange(contact.id, endDay)
  const { phase: finalPhase } = await director.determinePhase(contact.phone_whatsapp, agent.id)

  const romanticRate = (metrics.romanticMessages! / (metrics.messages / 2)) * 100
  const babeRate = (metrics.babeUsage! / (metrics.messages / 2)) * 100

  console.log(`✅ Phase 4 Complete: ${metrics.messages} messages, Trust ${finalAC!.trustScore}, Phase: ${finalPhase}`)
  console.log(`   Romantic: ${romanticRate.toFixed(1)}%, Babe: ${babeRate.toFixed(1)}%, Gift Hints: ${metrics.giftHints}`)
  console.log(`   Warnings: ${warnings.length}, Errors: ${errors.length}`)

  return { conversationHistory, metrics, finalPhase, warnings, errors }
}

// ============================================================================
// PAYMENT SIMULATION
// ============================================================================

async function simulatePayment(agent: any, contact: any, amount: number) {
  // Create payment record
  await prisma.payment.create({
    data: {
      id: `TEST-${Date.now()}-${Math.random()}`,
      amount,
      currency: 'USD',
      status: 'COMPLETED',
      payerName: contact.name,
      contactId: contact.id,
      method: 'PayPal'
    }
  })

  // Trigger escalation
  await escalationService.escalateOnPayment(agent.id, contact.id, amount)

  console.log(`💰 Payment simulated: $${amount}`)
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

async function generateReport(
  phase1: PhaseResults,
  phase2: PhaseResults,
  phase3: PhaseResults,
  phase4: PhaseResults
) {
  const totalMessages =
    phase1.metrics.messages +
    phase2.metrics.messages +
    phase3.metrics.messages +
    phase4.metrics.messages

  const totalWarnings =
    phase1.warnings.length +
    phase2.warnings.length +
    phase3.warnings.length +
    phase4.warnings.length

  const totalErrors =
    phase1.errors.length +
    phase2.errors.length +
    phase3.errors.length +
    phase4.errors.length

  const totalWords =
    phase1.conversationHistory.filter(t => t.sender === 'ai').reduce((sum, t) => sum + countWords(t.message), 0) +
    phase2.conversationHistory.filter(t => t.sender === 'ai').reduce((sum, t) => sum + countWords(t.message), 0) +
    phase3.conversationHistory.filter(t => t.sender === 'ai').reduce((sum, t) => sum + countWords(t.message), 0) +
    phase4.conversationHistory.filter(t => t.sender === 'ai').reduce((sum, t) => sum + countWords(t.message), 0)

  const totalAIMessages = totalMessages / 2
  const avgWords = totalWords / totalAIMessages

  const totalOver8 =
    phase1.metrics.messagesOver8Words +
    phase2.metrics.messagesOver8Words +
    phase3.metrics.messagesOver8Words +
    phase4.metrics.messagesOver8Words

  const over8Rate = (totalOver8 / totalAIMessages) * 100

  const romanticRate = phase4.metrics.romanticMessages! / (phase4.metrics.messages / 2) * 100
  const babeRate = phase4.metrics.babeUsage! / (phase4.metrics.messages / 2) * 100

  const report = `# Test Complet Lifecycle - Rapport Final

**Date:** ${new Date().toISOString()}
**Total Messages:** ${totalMessages}
**Durée Simulée:** 35 jours
**Phases Complétées:** 4/4 ✅

---

## Phase 1: CONNECTION (Jours 0-5)
- **Messages:** ${phase1.metrics.messages}
- **Trust:** ${phase1.metrics.trustProgression[0] || 0} → ${phase1.metrics.trustProgression[phase1.metrics.trustProgression.length - 1]}
- **Final Phase:** ${phase1.finalPhase}
- **IRL Refusal Rate:** ${phase1.metrics.irlRequests > 0 ? ((phase1.metrics.irlRefusals / phase1.metrics.irlRequests) * 100).toFixed(1) : 'N/A'}%
- **Messages >8 Words:** ${((phase1.metrics.messagesOver8Words / (phase1.metrics.messages / 2)) * 100).toFixed(1)}%
- **Separator Usage:** ${phase1.metrics.separatorUsage} messages
- **Validator Activations:** ${phase1.metrics.validatorActivations}
- **Warnings:** ${phase1.warnings.length}
- **Errors:** ${phase1.errors.length}

${phase1.warnings.length > 0 ? '### Warnings\n' + phase1.warnings.map(w => `- ${w}`).join('\n') : ''}
${phase1.errors.length > 0 ? '### Errors\n' + phase1.errors.map(e => `- ${e}`).join('\n') : ''}

---

## Phase 2: VULNERABILITY (Jours 5-12)
- **Messages:** ${phase2.metrics.messages}
- **Trust:** ${phase2.metrics.trustProgression[0] || 0} → ${phase2.metrics.trustProgression[phase2.metrics.trustProgression.length - 1]}
- **Final Phase:** ${phase2.finalPhase}
- **Pic Refusal Rate:** ${phase2.metrics.picRequests > 0 ? ((phase2.metrics.picRefusals / phase2.metrics.picRequests) * 100).toFixed(1) : 'N/A'}%
- **Voice Refusal Rate:** ${phase2.metrics.voiceRequests > 0 ? ((phase2.metrics.voiceRefusals / phase2.metrics.voiceRequests) * 100).toFixed(1) : 'N/A'}%
- **Messages >8 Words:** ${((phase2.metrics.messagesOver8Words / (phase2.metrics.messages / 2)) * 100).toFixed(1)}%
- **Separator Usage:** ${phase2.metrics.separatorUsage} messages
- **Validator Activations:** ${phase2.metrics.validatorActivations}
- **Warnings:** ${phase2.warnings.length}
- **Errors:** ${phase2.errors.length}

${phase2.warnings.length > 0 ? '### Warnings\n' + phase2.warnings.map(w => `- ${w}`).join('\n') : ''}
${phase2.errors.length > 0 ? '### Errors\n' + phase2.errors.map(e => `- ${e}`).join('\n') : ''}

---

## Phase 3: CRISIS (Jours 12-25)
- **Messages:** ${phase3.metrics.messages}
- **Trust:** ${phase3.metrics.trustProgression[0] || 0} → ${phase3.metrics.trustProgression[phase3.metrics.trustProgression.length - 1]}
- **Final Phase:** ${phase3.finalPhase}
- **Money Requests:** ${phase3.metrics.moneyRequests} (Target: ~${Math.floor(phase3.metrics.messages / 40)})
- **Payment Format Errors:** ${phase3.metrics.paymentFormatErrors}
- **Payment Tag Errors:** ${phase3.metrics.paymentTagErrors}
- **Messages >8 Words:** ${((phase3.metrics.messagesOver8Words / (phase3.metrics.messages / 2)) * 100).toFixed(1)}%
- **Validator Activations:** ${phase3.metrics.validatorActivations}
- **Warnings:** ${phase3.warnings.length}
- **Errors:** ${phase3.errors.length}

${phase3.warnings.length > 0 ? '### Warnings\n' + phase3.warnings.map(w => `- ${w}`).join('\n') : ''}
${phase3.errors.length > 0 ? '### Errors\n' + phase3.errors.map(e => `- ${e}`).join('\n') : ''}

---

## Phase 4: MONEYPOT (Jours 25-35)
- **Messages:** ${phase4.metrics.messages}
- **Trust:** ${phase4.metrics.trustProgression[0] || 0} → ${phase4.metrics.trustProgression[phase4.metrics.trustProgression.length - 1]}
- **Final Phase:** ${phase4.finalPhase}
- **Romantic Tone:** ${romanticRate.toFixed(1)}% (Target: >80%)
- **Babe Usage:** ${babeRate.toFixed(1)}% (Target: 10-20%)
- **Gift Hints:** ${phase4.metrics.giftHints}
- **Money Requests:** ${phase4.metrics.moneyRequests} (Target: ~${Math.floor(phase4.metrics.messages / 30)})
- **Escalation Tiers:** ${phase4.metrics.escalationTiers!.filter((t, i, arr) => i === 0 || t !== arr[i-1]).join(' → ')}
- **IRL Refusal Rate:** ${phase4.metrics.irlRequests > 0 ? ((phase4.metrics.irlRefusals / phase4.metrics.irlRequests) * 100).toFixed(1) : 'N/A'}%
- **Validator Activations:** ${phase4.metrics.validatorActivations}
- **Warnings:** ${phase4.warnings.length}
- **Errors:** ${phase4.errors.length}

${phase4.warnings.length > 0 ? '### Warnings\n' + phase4.warnings.map(w => `- ${w}`).join('\n') : ''}
${phase4.errors.length > 0 ? '### Errors\n' + phase4.errors.map(e => `- ${e}`).join('\n') : ''}

---

## Métriques Globales

- **Total Messages:** ${totalMessages}
- **Total AI Messages:** ${totalAIMessages}
- **Average Words/Message:** ${avgWords.toFixed(1)} (Target: 3-5)
- **Messages >8 Words:** ${over8Rate.toFixed(1)}% (Target: <5%)
- **Total Validator Activations:** ${phase1.metrics.validatorActivations + phase2.metrics.validatorActivations + phase3.metrics.validatorActivations + phase4.metrics.validatorActivations}
- **Total Mechanical Fallbacks:** ${phase1.metrics.mechanicalFallbacks + phase2.metrics.mechanicalFallbacks + phase3.metrics.mechanicalFallbacks + phase4.metrics.mechanicalFallbacks}
- **Total Warnings:** ${totalWarnings}
- **Total Errors:** ${totalErrors}

---

## Validations

| Metric | Value | Expected | Status |
|--------|-------|----------|--------|
| Total Messages | ${totalMessages} | 300-400 | ${totalMessages >= 300 && totalMessages <= 400 ? '✅' : '❌'} |
| Phases Completed | 4 | 4 | ✅ |
| Final Trust | ${phase4.metrics.trustProgression[phase4.metrics.trustProgression.length - 1]} | >85 | ${phase4.metrics.trustProgression[phase4.metrics.trustProgression.length - 1] > 85 ? '✅' : '❌'} |
| Avg Words/Msg | ${avgWords.toFixed(1)} | 3-5 | ${avgWords >= 3 && avgWords <= 5 ? '✅' : '⚠️'} |
| Messages >8 Words | ${over8Rate.toFixed(1)}% | <5% | ${over8Rate < 5 ? '✅' : '❌'} |
| IRL Refusals | 100% | 100% | ${(phase1.metrics.irlRefusals + phase2.metrics.irlRefusals + phase3.metrics.irlRefusals + phase4.metrics.irlRefusals) === (phase1.metrics.irlRequests + phase2.metrics.irlRequests + phase3.metrics.irlRequests + phase4.metrics.irlRequests) ? '✅' : '❌'} |
| Payment Errors | ${phase3.metrics.paymentFormatErrors! + phase3.metrics.paymentTagErrors!} | 0 | ${(phase3.metrics.paymentFormatErrors! + phase3.metrics.paymentTagErrors!) === 0 ? '✅' : '❌'} |
| Romantic Tone (P4) | ${romanticRate.toFixed(1)}% | >80% | ${romanticRate > 80 ? '✅' : '❌'} |

---

## Success Rate

**${totalErrors === 0 && over8Rate < 5 && romanticRate > 80 ? '✅ PASS' : '⚠️ PARTIAL PASS'}**

- Errors: ${totalErrors}
- Warnings: ${totalWarnings}
- Critical Issues: ${totalErrors + (over8Rate >= 5 ? 1 : 0) + (romanticRate <= 80 ? 1 : 0)}
`

  const fs = require('fs')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
  const filename = `test-lifecycle-report-${timestamp}.md`

  fs.writeFileSync(filename, report)

  console.log(`\n📊 Report saved: ${filename}`)
  console.log(`\n${report}`)
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runFullLifecycleTest(options: TestOptions = {}) {
  const startTime = Date.now()

  console.log('🚀 Starting Full Lifecycle Test (300-400 messages)...')
  console.log('━'.repeat(80))

  // Prepare to save all messages
  const allMessages: ConversationTurn[] = []

  try {
    // Setup
    const { agent, contact, settings } = await setupTestEnvironment()

    // Phase 1: CONNECTION
    const phase1 = await runPhase1(agent, contact, settings, 0, 5, options.showOutput || false)
    allMessages.push(...phase1.conversationHistory)

    // Phase 2: VULNERABILITY
    const phase2 = await runPhase2(
      agent,
      contact,
      settings,
      phase1.conversationHistory,
      5,
      12,
      options.showOutput || false
    )
    allMessages.push(...phase2.conversationHistory)

    // Merge conversation history
    const historyAfterP2 = [...phase1.conversationHistory, ...phase2.conversationHistory]

    // Phase 3: CRISIS
    const phase3 = await runPhase3(
      agent,
      contact,
      settings,
      historyAfterP2,
      12,
      25,
      options.showOutput || false
    )
    allMessages.push(...phase3.conversationHistory)

    // Merge conversation history
    const historyAfterP3 = [...historyAfterP2, ...phase3.conversationHistory]

    // Phase 4: MONEYPOT
    const phase4 = await runPhase4(
      agent,
      contact,
      settings,
      historyAfterP3,
      25,
      35,
      options.showOutput || false
    )
    allMessages.push(...phase4.conversationHistory)

    // Generate report
    console.log('\n' + '━'.repeat(80))
    console.log('📊 Generating Final Report...')
    console.log('━'.repeat(80))

    await generateReport(phase1, phase2, phase3, phase4)

    // Save all messages to JSON
    const fs = require('fs')
    const messagesFile = 'test-lifecycle-messages.json'
    fs.writeFileSync(messagesFile, JSON.stringify(allMessages, null, 2))
    console.log(`\n💾 All messages saved to: ${messagesFile}`)

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(1)

    console.log(`\n✅ Test Complete in ${duration}s`)
    console.log('━'.repeat(80))

  } catch (error) {
    console.error('\n❌ Test Failed:', error)
    throw error
  }
}

// ============================================================================
// EXECUTION
// ============================================================================

runFullLifecycleTest({
  showOutput: process.argv.includes('--show-output'),
  quiet: process.argv.includes('--quiet')
})
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
