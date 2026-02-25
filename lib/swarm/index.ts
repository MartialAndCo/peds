import { prisma } from '@/lib/prisma'
import { SwarmGraph } from './graph'
import { settingsService } from '@/lib/settings-cache'
import {
  intentionNode,
  memoryNode,
  personaNode,
  timingNode,
  phaseNode,
  styleNode,
  paymentNode,
  mediaNode,
  voiceNode,
  safetyNode,
  responseNode,
  validationNode
} from './nodes'
import type { AgentProfile, Message, SwarmOptions, SwarmState } from './types'

// NOTE: API key is fetched from DB settings (with cache) to allow hot swapping

function readText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
}

function mapHistoryToMessages(history: unknown[]): Message[] {
  if (!Array.isArray(history)) return []

  const messages: Message[] = []

  for (const entry of history) {
    const raw = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null
    const role = typeof raw?.role === 'string' ? raw.role : 'user'
    const content = typeof raw?.content === 'string' ? raw.content : ''
    const timestamp = raw?.timestamp instanceof Date ? raw.timestamp : undefined

    if (!content.trim()) continue

    messages.push({
      role,
      content,
      ...(timestamp ? { timestamp } : {})
    })
  }

  return messages
}

function buildKnownFactsContext(contact: any, fallbackName: string): string {
  const facts: string[] = []

  const contactName = readText(contact?.name)
  if (contactName && !/^(inconnu|unknown|discord user)$/i.test(contactName)) {
    facts.push(`Son prénom est ${contactName}.`)
  }

  const profile =
    contact?.profile && typeof contact.profile === 'object' && !Array.isArray(contact.profile)
      ? (contact.profile as Record<string, unknown>)
      : null

  if (profile) {
    const profileName = readText(profile.name)
    if (profileName && !/^(inconnu|unknown)$/i.test(profileName)) {
      facts.push(`Il se présente comme ${profileName}.`)
    }

    const age = Number(profile.age)
    if (Number.isFinite(age) && age > 0 && age < 120) {
      facts.push(`Il a ${Math.round(age)} ans.`)
    }

    const location = readText(profile.location || profile.city || profile.country)
    if (location) {
      facts.push(`Il vient de ${location}.`)
    }

    const job = readText(profile.job || profile.occupation || profile.workplace)
    if (job) {
      facts.push(`Il travaille comme ${job}.`)
    }
  }

  const notesRaw = readText(contact?.notes)
  if (notesRaw) {
    const notesClean = notesRaw
      .replace(/\[Smart Add[^\]]*\]/gi, '')
      .replace(/\[Lead Update\]:/gi, '')
      .replace(/^Context:\s*/i, '')
      .trim()

    if (notesClean) {
      const excerpt = notesClean.length > 320 ? `${notesClean.slice(0, 320)}...` : notesClean
      facts.push(`Contexte opérateur: ${excerpt}`)
    }
  }

  if (facts.length === 0) return ''

  const targetName = readText(fallbackName) || 'CETTE PERSONNE'
  return `[BASE FACTS CONNUS SUR ${targetName}]:\n${facts.map((f) => `- ${f}`).join('\n')}\n\n⚠️ RÈGLE ABSOLUE: Ne JAMAIS redemander une info déjà présente dans ces facts.`
}

export async function runSwarm(
  userMessage: string,
  history: unknown[],
  contactId: string,
  agentId: string,
  userName: string,
  options: SwarmOptions = {}
): Promise<string> {
  const {
    lastMessageType,
    platform = 'whatsapp',
    preloadedProfile,
    externalSystemContext,
    simulationMode
  } = options

  console.log(`[Swarm] Starting swarm for: "${userMessage.substring(0, 50)}..."`)
  console.log(`[Swarm] Contact: ${contactId}, Agent: ${agentId}`)
  const dbStartTime = Date.now()

  const stateMessages = mapHistoryToMessages(history ?? [])

  const profileLoadPromise = preloadedProfile
    ? Promise.resolve(preloadedProfile)
    : prisma.agentProfile.findUnique({
        where: { agentId },
        select: {
          contextTemplate: true,
          styleRules: true,
          identityTemplate: true,
          phaseConnectionTemplate: true,
          phaseVulnerabilityTemplate: true,
          phaseCrisisTemplate: true,
          phaseMoneypotTemplate: true,
          paymentRules: true,
          safetyRules: true,
          timezone: true,
          locale: true,
          baseAge: true,
          bankAccountNumber: true,
          bankRoutingNumber: true
        }
      })

  const [contact, profile, agentContact, activeConversation, agentSettings, activeScenarioData] =
    await Promise.all([
      prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          phone_whatsapp: true,
          name: true,
          notes: true,
          profile: true
        }
      }),

      profileLoadPromise,

      prisma.agentContact.findFirst({
        where: { agentId, contactId },
        select: { phase: true, signals: true, paymentEscalationTier: true }
      }),

      prisma.conversation.findFirst({
        where: {
          contactId,
          agentId,
          status: { in: ['active', 'paused'] }
        },
        orderBy: { createdAt: 'desc' },
        select: { metadata: true }
      }),

      settingsService.getAgentSettings(agentId),

      prisma.activeScenario.findFirst({
        where: {
          contactId,
          status: 'RUNNING'
        },
        include: {
          scenario: true
        }
      })
    ])

  const dbDuration = Date.now() - dbStartTime
  console.log(`[Swarm] DB queries completed in ${dbDuration}ms (parallel)`)

  if (!profile) throw new Error('Profile not found')

  const contactPhone = contact?.phone_whatsapp || contactId
  const phase = agentContact?.phase || 'CONNECTION'
  const knownFacts = buildKnownFactsContext(contact, userName || contact?.name || 'CETTE PERSONNE')

  const conversationMetadata = activeConversation?.metadata as Record<string, any> | null
  const leadContext = conversationMetadata?.leadContext || conversationMetadata?.previousContext
  const leadPlatform = conversationMetadata?.platform || 'previous platform'

  const veniceApiKey = (agentSettings['venice_api_key'] as string) || process.env.VENICE_API_KEY || ''

  const initialState: SwarmState = {
    userMessage,
    history: stateMessages,
    messages: stateMessages,
    contactId,
    contactPhone,
    agentId,
    userName,
    lastMessageType: lastMessageType || 'text',
    platform,
    externalSystemContext: externalSystemContext || undefined,
    simulationMode: simulationMode || false,
    settings: {
      venice_api_key: veniceApiKey,
      venice_model: (agentSettings['venice_model'] as string) || 'google-gemma-3-27b-it',
      timezone: profile.timezone || 'Europe/Paris',
      locale: profile.locale || 'fr-FR',
      payment_paypal_enabled: agentSettings['payment_paypal_enabled'] === 'true',
      payment_paypal_username: agentSettings['payment_paypal_username'] as string,
      payment_venmo_enabled: agentSettings['payment_venmo_enabled'] === 'true',
      payment_venmo_username: agentSettings['payment_venmo_username'] as string,
      payment_cashapp_enabled: agentSettings['payment_cashapp_enabled'] === 'true',
      payment_cashapp_username: agentSettings['payment_cashapp_username'] as string,
      payment_zelle_enabled: agentSettings['payment_zelle_enabled'] === 'true',
      payment_zelle_username: agentSettings['payment_zelle_username'] as string,
      payment_bank_enabled: agentSettings['payment_bank_enabled'] === 'true',
      payment_custom_methods: agentSettings['payment_custom_methods'] as string,
      voice_response_enabled:
        agentSettings['voice_response_enabled'] === 'true' ||
        agentSettings['voice_response_enabled'] === true,
      validation_llm_enabled:
        agentSettings['validation_llm_enabled'] === 'true' ||
        agentSettings['validation_llm_enabled'] === true
    },
    contexts: {
      persona: '',
      style: profile.styleRules || '',
      phase: '',
      timing: '',
      knownFacts,
      memory: '',
      payment: '',
      media: '',
      voice: '',
      lead: leadContext ? `[IMPORTED FROM ${leadPlatform.toUpperCase()}]: ${leadContext}` : ''
    },
    profile,
    currentPhase: phase,
    leadContext: leadContext || undefined,
    agentContact: agentContact || undefined,
    metadata: {
      nodeMetrics: {}
    },
    activeScenario: activeScenarioData
      ? {
          scenarioId: activeScenarioData.scenarioId,
          title: activeScenarioData.scenario.title,
          description: activeScenarioData.scenario.description,
          targetContext: activeScenarioData.scenario.targetContext
        }
      : undefined
  }

  const graph = new SwarmGraph()

  graph.addNode('intention', intentionNode, [], { isLLM: true })

  graph.addNode('persona', personaNode, ['intention'], { isLLM: false })
  graph.addNode('timing', timingNode, ['intention'], { isLLM: false })
  graph.addNode('phase', phaseNode, ['intention'], { isLLM: false })
  graph.addNode('style', styleNode, ['intention'], { isLLM: false })
  graph.addNode('safety', safetyNode, ['intention'], { isLLM: false })

  graph.addNode(
    'memory',
    async (state: SwarmState) => {
      console.log('[Swarm][Memory] Always-on memory loading...')
      return await memoryNode(state)
    },
    ['intention'],
    { isLLM: false }
  )

  graph.addNode(
    'payment',
    async (state: SwarmState) => {
      if (state.intention?.besoinPayment && profile.paymentRules) {
        console.log('[Swarm][Payment] Need detected, loading payment rules...')
        return await paymentNode(state)
      }
      return { contexts: { ...state.contexts, payment: '' } }
    },
    ['intention'],
    { isLLM: true }
  )

  graph.addNode(
    'media',
    async (state: SwarmState) => {
      if (state.intention?.besoinMedia) {
        console.log('[Swarm][Media] Need detected, analyzing media request...')
        return await mediaNode(state)
      }
      console.log('[Swarm][Media] No need, skipping')
      return { contexts: { ...state.contexts, media: '' } }
    },
    ['intention'],
    { isLLM: false }
  )

  graph.addNode(
    'voice',
    async (state: SwarmState) => {
      if (
        state.intention?.besoinVoice ||
        state.lastMessageType === 'voice' ||
        state.lastMessageType === 'ptt'
      ) {
        console.log('[Swarm][Voice] Need detected, analyzing voice context...')
        return await voiceNode(state)
      }
      console.log('[Swarm][Voice] No need, skipping')
      return { contexts: { ...state.contexts, voice: '' } }
    },
    ['intention'],
    { isLLM: false }
  )

  graph.addNode(
    'response',
    responseNode,
    ['persona', 'timing', 'phase', 'style', 'memory', 'payment', 'media', 'voice', 'safety'],
    { isLLM: true }
  )

  graph.addNode('validation', validationNode, ['response'], { isLLM: true })

  console.log('[Swarm] Executing graph...')
  const finalState = await graph.execute('intention', initialState)

  console.log('[Swarm] Graph execution complete')

  if (finalState.error) {
    console.error('[Swarm] Error during execution:', finalState.error)
  }

  if (!finalState.response) {
    console.error('[Swarm] CRITICAL: No response generated (Venice likely failed)')
    throw new Error('VENICE_API_REJECTED: No response from AI')
  }

  return finalState.response
}
