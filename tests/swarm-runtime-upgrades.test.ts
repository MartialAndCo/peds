import { venice } from '../lib/venice'
import { SwarmGraph } from '../lib/swarm/graph'
import { responseNode } from '../lib/swarm/nodes/response-node'
import { buildBudgetedPrompt } from '../lib/swarm/utils/prompt-budget'

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

function createBaseState() {
  return {
    userMessage: 'test',
    history: [],
    messages: [],
    contactId: 'contact_1',
    agentId: 'agent_1',
    settings: {
      venice_api_key: 'fake-key',
      venice_model: 'google-gemma-3-27b-it',
      timezone: 'Europe/Paris',
      locale: 'fr-FR'
    },
    contexts: {},
    metadata: { nodeMetrics: {} }
  }
}

async function testContextPropagationToPrompt() {
  console.log('\n[TEST] responseNode - externalSystemContext propagation')

  const originalChatCompletion = venice.chatCompletion.bind(venice)
  let capturedSystemPrompt = ''

  ;(venice as any).chatCompletion = async (
    systemPrompt: string,
    _history: any[],
    _userMessage: string,
    _config: any
  ) => {
    capturedSystemPrompt = systemPrompt
    return 'ok'
  }

  try {
    const state: any = {
      ...createBaseState(),
      userMessage: 'yo',
      externalSystemContext: '[SYSTEM] pending queue IDs: 42, 43',
      messages: [{ role: 'user', content: 'salut' }],
      profile: { baseAge: 16, locale: 'fr-FR' },
      platform: 'whatsapp',
      contexts: {
        timing: '',
        knownFacts: '',
        memory: '',
        phase: '',
        persona: '',
        style: '',
        payment: '',
        media: '',
        voice: '',
        safety: '',
        lead: ''
      }
    }

    const result = await responseNode(state)

    assert('external system context included', capturedSystemPrompt.includes('[SYSTEM] pending queue IDs: 42, 43'))
    assert('response returned', result.response === 'ok', `response=${result.response}`)
  } finally {
    ;(venice as any).chatCompletion = originalChatCompletion
  }
}

async function testPromptBudgetTruncation() {
  console.log('\n[TEST] buildBudgetedPrompt - truncation and priority')

  const systemSection = 'SYSTEM CONSTRAINTS MUST STAY'
  const lowPriority = 'LOW '.repeat(400)
  const history = 'HISTORY '.repeat(300)

  const prompt = buildBudgetedPrompt(
    [
      { id: 'system-constraints', priority: 100, content: systemSection },
      { id: 'low-hints', priority: 1, content: lowPriority },
      { id: 'conversation-history', priority: 2, content: history }
    ],
    280
  )

  assert('prompt stays under cap', prompt.length <= 280, `len=${prompt.length}`)
  assert('system constraints preserved', prompt.includes(systemSection))
  assert('low priority removed first', !prompt.includes('LOW LOW LOW'))
}

async function testGraphMergeEmptyString() {
  console.log('\n[TEST] SwarmGraph - empty string overwrite')

  const graph = new SwarmGraph()
  graph.addNode(
    'root',
    async (state: any) => ({
      contexts: { ...state.contexts, style: 'value' }
    }),
    [],
    { isLLM: false }
  )

  graph.addNode(
    'clear',
    async (state: any) => ({
      contexts: { ...state.contexts, style: '' }
    }),
    ['root'],
    { isLLM: false }
  )

  const finalState = await graph.execute('root', {
    ...createBaseState(),
    contexts: { style: 'seed' }
  } as any)

  assert(
    'empty string overwrites previous value',
    finalState.contexts.style === '',
    `style=${finalState.contexts.style}`
  )
}

async function testDeterministicExecutionOrder() {
  console.log('\n[TEST] SwarmGraph - deterministic ready-node ordering')

  const runOnce = async () => {
    const graph = new SwarmGraph()

    graph.addNode('root', async () => ({}), [], { isLLM: false })

    graph.addNode(
      'b_node',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        return {}
      },
      ['root'],
      { isLLM: false }
    )

    graph.addNode(
      'a_node',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        return {}
      },
      ['root'],
      { isLLM: false }
    )

    const finalState = await graph.execute('root', createBaseState() as any)
    return (finalState.metadata.executionOrder || []).join(',')
  }

  const order1 = await runOnce()
  const order2 = await runOnce()

  assert('deterministic order run #1', order1 === 'root,a_node,b_node', `order=${order1}`)
  assert('deterministic order run #2', order2 === 'root,a_node,b_node', `order=${order2}`)
  assert('same order across runs', order1 === order2)
}

async function main() {
  console.log('=== SWARM RUNTIME UPGRADE TESTS ===')

  await testContextPropagationToPrompt()
  await testPromptBudgetTruncation()
  await testGraphMergeEmptyString()
  await testDeterministicExecutionOrder()

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('Fatal test error:', error)
  process.exit(1)
})

