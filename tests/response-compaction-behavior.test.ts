import { prisma } from '../lib/prisma'
import { queueService } from '../lib/services/queue-service'
import { responseNode } from '../lib/swarm/nodes/response-node'
import { venice } from '../lib/venice'

let passed = 0
let failed = 0

function assert(testName: string, condition: boolean, details?: string) {
  if (condition) {
    passed += 1
    console.log(`  PASS ${testName}`)
    return
  }

  failed += 1
  console.log(`  FAIL ${testName}${details ? ` (${details})` : ''}`)
}

function baseResponseState() {
  return {
    userMessage: '',
    history: [],
    messages: [],
    contactId: 'contact_1',
    contactPhone: '+33123456789',
    agentId: 'agent_1',
    userName: 'Alex',
    settings: {
      venice_api_key: 'fake-key',
      venice_model: 'google-gemma-3-27b-it',
      timezone: 'Europe/Paris',
      locale: 'fr-FR'
    },
    contexts: {
      persona: '',
      style: '',
      phase: '',
      timing: '',
      knownFacts: '',
      memory: '',
      payment: '',
      media: '',
      voice: '',
      lead: '',
      safety: ''
    },
    profile: {
      baseAge: 16,
      locale: 'fr-FR'
    },
    platform: 'whatsapp',
    metadata: {
      nodeMetrics: {}
    }
  } as any
}

async function testQueueServiceCompactsToSingleSend() {
  console.log('\n[TEST] queue-service compaction keeps only newest queued response')

  const originalCleanup = (queueService as any).cleanupStuckJobs
  const originalSingle = (queueService as any).processSingleItem
  const originalTx = (prisma as any).$transaction
  const originalUpdateMany = (prisma.messageQueue as any).updateMany
  const originalFindFirst = (prisma.messageQueue as any).findFirst

  const processedIds: string[] = []
  const cancelledPayloads: any[] = []

  const lockedItems = [
    {
      id: 'q_old_1',
      content: 'old 1',
      mediaUrl: null,
      mediaType: null,
      duration: null,
      scheduledAt: new Date('2026-02-26T18:00:00.000Z'),
      contact: { id: 'c1', phone_whatsapp: '+33000000001' },
      conversation: { id: 101, agentId: 'agent_1' }
    },
    {
      id: 'q_old_2',
      content: 'old 2',
      mediaUrl: null,
      mediaType: null,
      duration: null,
      scheduledAt: new Date('2026-02-26T18:01:00.000Z'),
      contact: { id: 'c1', phone_whatsapp: '+33000000001' },
      conversation: { id: 101, agentId: 'agent_1' }
    },
    {
      id: 'q_newest',
      content: 'newest',
      mediaUrl: null,
      mediaType: null,
      duration: null,
      scheduledAt: new Date('2026-02-26T18:02:00.000Z'),
      contact: { id: 'c1', phone_whatsapp: '+33000000001' },
      conversation: { id: 101, agentId: 'agent_1' }
    }
  ]

  ;(queueService as any).cleanupStuckJobs = async () => {}
  ;(queueService as any).processSingleItem = async (queueItem: any) => {
    processedIds.push(queueItem.id)
    return { id: queueItem.id, status: 'success' }
  }

  ;(prisma as any).$transaction = async (cb: any) => {
    const tx = {
      messageQueue: {
        findMany: async () => lockedItems,
        update: async () => ({})
      }
    }
    return cb(tx)
  }

  ;(prisma.messageQueue as any).updateMany = async (args: any) => {
    if (args?.data?.status === 'CANCELLED_SUPERSEDED') {
      cancelledPayloads.push(args)
      return { count: 2 }
    }
    return { count: 0 }
  }

  ;(prisma.messageQueue as any).findFirst = async () => null

  try {
    const result = await queueService.processPendingMessages()

    assert('only newest item processed', processedIds.length === 1 && processedIds[0] === 'q_newest', `processed=${processedIds.join(',')}`)
    assert('superseded items cancelled', cancelledPayloads.length === 1, `cancelCalls=${cancelledPayloads.length}`)
    assert('result includes processed entries', result.processed >= 1, `processed=${result.processed}`)
  } finally {
    ;(queueService as any).cleanupStuckJobs = originalCleanup
    ;(queueService as any).processSingleItem = originalSingle
    ;(prisma as any).$transaction = originalTx
    ;(prisma.messageQueue as any).updateMany = originalUpdateMany
    ;(prisma.messageQueue as any).findFirst = originalFindFirst
  }
}

async function testResponseNodePromptForRelatedQuestions() {
  console.log('\n[TEST] response-node prompt stays natural for related questions')

  const originalChatCompletion = venice.chatCompletion.bind(venice)
  let capturedSystemPrompt = ''
  let capturedHistory: any[] = []

  ;(venice as any).chatCompletion = async (
    systemPrompt: string,
    history: any[],
    _userMessage: string
  ) => {
    capturedSystemPrompt = systemPrompt
    capturedHistory = history
    return "j'ai 16 ans, je suis de Lyon et je suis au lycee."
  }

  try {
    const state = baseResponseState()
    state.userMessage = 'et tu fais quoi dans la vie ?'
    state.messages = [
      { role: 'assistant', content: 'hey 😊' },
      { role: 'user', content: "tu viens d'ou ?" },
      { role: 'user', content: 'tu as quel age ?' },
      { role: 'user', content: 'et tu fais quoi dans la vie ?' }
    ]

    const result = await responseNode(state)

    assert('system prompt enforces one single reply', capturedSystemPrompt.includes('UNE seule reponse') || capturedSystemPrompt.includes('ONE single reply'))
    assert('history keeps all related user points', capturedHistory.filter((h) => h.role === 'user').length >= 3, `userHistory=${capturedHistory.length}`)
    assert('related scenario output feels compact', (result.response || '').split(' ').length <= 18, `response=${result.response}`)
  } finally {
    ;(venice as any).chatCompletion = originalChatCompletion
  }
}

async function testResponseNodePromptForUnrelatedQuestions() {
  console.log('\n[TEST] response-node prompt with unrelated questions')

  const originalChatCompletion = venice.chatCompletion.bind(venice)
  let capturedHistory: any[] = []

  ;(venice as any).chatCompletion = async (
    _systemPrompt: string,
    history: any[],
    _userMessage: string
  ) => {
    capturedHistory = history
    return "il fait beau ici, je m'y connais peu en crypto, et j'aime Inception."
  }

  try {
    const state = baseResponseState()
    state.userMessage = 'et ton film prefere ?'
    state.messages = [
      { role: 'assistant', content: 'salut toi' },
      { role: 'user', content: 'il fait quel temps chez toi ?' },
      { role: 'user', content: 'tu penses quoi du bitcoin ?' },
      { role: 'user', content: 'et ton film prefere ?' }
    ]

    const result = await responseNode(state)
    const response = String(result.response || '')
    const wordCount = response.trim().split(/\s+/).length

    assert('history keeps unrelated points too', capturedHistory.filter((h) => h.role === 'user').length >= 3, `userHistory=${capturedHistory.length}`)
    assert('single consolidated output generated', response.length > 0, 'empty response')
    assert('unrelated scenario risk remains controlled', wordCount <= 22, `wordCount=${wordCount}`)
  } finally {
    ;(venice as any).chatCompletion = originalChatCompletion
  }
}

async function main() {
  console.log('=== RESPONSE COMPACTION BEHAVIOR TESTS ===')

  await testQueueServiceCompactsToSingleSend()
  await testResponseNodePromptForRelatedQuestions()
  await testResponseNodePromptForUnrelatedQuestions()

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('Fatal test error:', error)
  process.exit(1)
})

