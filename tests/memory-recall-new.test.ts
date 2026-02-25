import { memoryNode } from '@/lib/swarm/nodes/memory-node'
import { responseNode } from '@/lib/swarm/nodes/response-node'
import { memoryService } from '@/lib/memory'
import { venice } from '@/lib/venice'

let passed = 0
let failed = 0

function assert(testName: string, condition: boolean, details?: string) {
  if (condition) {
    passed++
    console.log(`  PASS ${testName}`)
    return
  }

  failed++
  console.log(`  FAIL ${testName}${details ? ` (${details})` : ''}`)
}

async function testMemoryNodeUsesCurrentUserMessage() {
  console.log('\n[TEST] memoryNode - compact memory + current query')

  const originalSearch = memoryService.search.bind(memoryService)
  const originalGetAll = memoryService.getAll.bind(memoryService)

  let capturedQuery = ''

  ;(memoryService as any).search = async (_userId: string, query: string) => {
    capturedQuery = query
    return [
      { memory: "User's name is Marc" },
      { memory: 'User is 28 years old' },
      { memory: 'User is 28 years old' } // duplicate on purpose
    ]
  }

  ;(memoryService as any).getAll = async (_userId: string) => {
    return [
      { memory: "User's name is Marc" },
      { memory: 'User is 28 years old' },
      { memory: 'User is from Lyon' },
      { memory: 'User likes football' },
      { memory: 'User works night shifts' },
      { memory: 'User has a dog named Pixel' },
      { memory: 'Extra memory that should be trimmed by max item cap' }
    ]
  }

  try {
    const state: any = {
      userMessage: 'je bosse de nuit cette semaine',
      history: [{ role: 'user', content: 'old query should not be used' }],
      contactId: 'contact_1',
      contactPhone: '+33123456789',
      agentId: 'agent_1',
      userName: 'Marc',
      contexts: {}
    }

    const result = await memoryNode(state)
    const memoryContext = result.contexts?.memory || ''

    assert(
      'search query uses current userMessage',
      capturedQuery === 'je bosse de nuit cette semaine',
      `query="${capturedQuery}"`
    )

    const bulletCount = (memoryContext.match(/^- /gm) || []).length
    assert(
      'memory list is compact (<= 6)',
      bulletCount <= 6,
      `bulletCount=${bulletCount}`
    )

    assert(
      'anti re-ask rule is present',
      memoryContext.includes('Ne JAMAIS redemander')
    )
  } finally {
    ;(memoryService as any).search = originalSearch
    ;(memoryService as any).getAll = originalGetAll
  }
}

async function testResponseNodePrioritizesKnownFacts() {
  console.log('\n[TEST] responseNode - known facts before memory')

  const originalChatCompletion = venice.chatCompletion.bind(venice)
  let capturedSystemPrompt = ''

  ;(venice as any).chatCompletion = async (
    systemPrompt: string,
    _history: any[],
    _userMessage: string,
    _config: any
  ) => {
    capturedSystemPrompt = systemPrompt
    return 'ok noted'
  }

  try {
    const state: any = {
      userMessage: 'tu te souviens de moi ?',
      contexts: {
        timing: 'TIMING_CONTEXT',
        persona: 'PERSONA_CONTEXT',
        phase: 'PHASE_CONTEXT',
        style: 'STYLE_CONTEXT long enough to pass the threshold',
        knownFacts: '[BASE FACTS CONNUS]\n- Il a 28 ans\n- Il vient de Lyon',
        memory: '[MEMOIRE CONTEXTUELLE]\n- Il aime le foot',
        payment: '',
        media: '',
        voice: '',
        safety: 'SAFETY_CONTEXT',
        lead: ''
      },
      settings: {
        venice_api_key: 'fake-key'
      },
      history: [{ role: 'user', content: 'salut' }],
      agentId: 'agent_1',
      profile: { baseAge: 15, locale: 'fr-FR' },
      platform: 'whatsapp'
    }

    const result = await responseNode(state)

    assert(
      'known facts are present in final system prompt',
      capturedSystemPrompt.includes('[BASE FACTS CONNUS]')
    )

    const factsPos = capturedSystemPrompt.indexOf('[BASE FACTS CONNUS]')
    const memoryPos = capturedSystemPrompt.indexOf('[MEMOIRE CONTEXTUELLE]')
    assert(
      'known facts are injected before memory',
      factsPos !== -1 && memoryPos !== -1 && factsPos < memoryPos,
      `factsPos=${factsPos}, memoryPos=${memoryPos}`
    )

    assert(
      'prompt no longer encourages re-asking origin',
      !capturedSystemPrompt.includes('tu viens d\'où ?') &&
      !capturedSystemPrompt.includes('where u from?')
    )

    assert(
      'responseNode returns model output',
      result.response === 'ok noted',
      `response=${result.response}`
    )
  } finally {
    ;(venice as any).chatCompletion = originalChatCompletion
  }
}

async function main() {
  console.log('=== MEMORY RECALL NEW TESTS ===')
  await testMemoryNodeUsesCurrentUserMessage()
  await testResponseNodePrioritizesKnownFacts()

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('Fatal test error:', error)
  process.exit(1)
})

