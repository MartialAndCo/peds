import { prisma } from '@/lib/prisma';
import { SwarmGraph } from './graph';
import { settingsService } from '@/lib/settings-cache';
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
} from './nodes';
import type { SwarmState, IntentionResult, AgentProfile } from './types';

// NOTE: API key is now fetched from DB (settings) not env var, to allow hot-swapping

export interface SwarmOptions {
  lastMessageType?: string;
  platform?: 'whatsapp' | 'discord';
  preloadedProfile?: AgentProfile; // Pour éviter re-requête si déjà chargé
}

function readText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function buildKnownFactsContext(contact: any, fallbackName: string): string {
  const facts: string[] = [];

  const contactName = readText(contact?.name);
  if (contactName && !/^(inconnu|unknown|discord user)$/i.test(contactName)) {
    facts.push(`Son prénom est ${contactName}.`);
  }

  const profile = (contact?.profile && typeof contact.profile === 'object' && !Array.isArray(contact.profile))
    ? (contact.profile as Record<string, unknown>)
    : null;

  if (profile) {
    const profileName = readText(profile.name);
    if (profileName && !/^(inconnu|unknown)$/i.test(profileName)) {
      facts.push(`Il se présente comme ${profileName}.`);
    }

    const age = Number(profile.age);
    if (Number.isFinite(age) && age > 0 && age < 120) {
      facts.push(`Il a ${Math.round(age)} ans.`);
    }

    const location = readText(profile.location || profile.city || profile.country);
    if (location) {
      facts.push(`Il vient de ${location}.`);
    }

    const job = readText(profile.job || profile.occupation || profile.workplace);
    if (job) {
      facts.push(`Il travaille comme ${job}.`);
    }
  }

  const notesRaw = readText(contact?.notes);
  if (notesRaw) {
    const notesClean = notesRaw
      .replace(/\[Smart Add[^\]]*\]/gi, '')
      .replace(/\[Lead Update\]:/gi, '')
      .replace(/^Context:\s*/i, '')
      .trim();

    if (notesClean) {
      const excerpt = notesClean.length > 320 ? `${notesClean.slice(0, 320)}...` : notesClean;
      facts.push(`Contexte opérateur: ${excerpt}`);
    }
  }

  if (facts.length === 0) return '';

  const targetName = readText(fallbackName) || 'CETTE PERSONNE';
  return `[BASE FACTS CONNUS SUR ${targetName}]:\n${facts.map((f) => `- ${f}`).join('\n')}\n\n⚠️ RÈGLE ABSOLUE: Ne JAMAIS redemander une info déjà présente dans ces facts.`;
}

export async function runSwarm(
  userMessage: string,
  history: any[],
  contactId: string,
  agentId: string,
  userName: string,
  options: SwarmOptions = {}
): Promise<string> {
  const { lastMessageType, platform = 'whatsapp', preloadedProfile } = options;
  console.log(`[Swarm] Starting swarm for: "${userMessage.substring(0, 50)}..."`);
  console.log(`[Swarm] Contact: ${contactId}, Agent: ${agentId}`);
  const dbStartTime = Date.now();

  // 🔥 OPTIMISATION: Toutes les requêtes DB en PARALLÈLE
  // Si preloadedProfile est fourni, on évite de re-requêter
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
    });

  const [
    contact,
    profile,
    agentContact,
    activeConversation,
    agentSettings,
    activeScenarioData
  ] = await Promise.all([
    // 1. Contact pour le phone (mémoires)
    prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        phone_whatsapp: true,
        name: true,
        notes: true,
        profile: true
      }
    }),

    // 2. Profile complet de l'agent (ou preloaded)
    profileLoadPromise,

    // 3. Phase et signals
    prisma.agentContact.findFirst({
      where: { agentId, contactId },
      select: { phase: true, signals: true, paymentEscalationTier: true }
    }),

    // 4. Conversation active (leadContext)
    prisma.conversation.findFirst({
      where: {
        contactId,
        agentId,
        status: { in: ['active', 'paused'] }
      },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true }
    }),

    // 5. Settings (avec cache) - pour payment-node et autres
    settingsService.getAgentSettings(agentId),

    // 6. Active Scenario (if any)
    prisma.activeScenario.findFirst({
      where: {
        contactId,
        status: 'RUNNING'
      },
      include: {
        scenario: true
      }
    })
  ]);

  const dbDuration = Date.now() - dbStartTime;
  console.log(`[Swarm] DB queries completed in ${dbDuration}ms (parallel)`);

  if (!profile) throw new Error('Profile not found');

  const contactPhone = contact?.phone_whatsapp || contactId;
  const phase = agentContact?.phase || 'CONNECTION';
  const knownFacts = buildKnownFactsContext(contact, userName || contact?.name || 'CETTE PERSONNE');

  // Extraire le leadContext si présent
  const metadata = activeConversation?.metadata as any;
  const leadContext = metadata?.leadContext || metadata?.previousContext;
  const leadPlatform = metadata?.platform || 'previous platform';

  // Récupérer la clé API Venice depuis les settings (déjà chargés avec cache)
  const veniceApiKey = agentSettings['venice_api_key'] as string || process.env.VENICE_API_KEY || '';

  // Initial state - TOUS les données préchargées
  const initialState: SwarmState = {
    userMessage,
    history,
    contactId,
    contactPhone,
    agentId,
    userName,
    lastMessageType: lastMessageType || 'text',
    platform,
    settings: {
      venice_api_key: veniceApiKey,
      venice_model: (agentSettings['venice_model'] as string) || 'google-gemma-3-27b-it',
      timezone: profile.timezone || 'Europe/Paris',
      locale: profile.locale || 'fr-FR',
      // Payment settings pour éviter requête dans payment-node
      payment_paypal_enabled: agentSettings['payment_paypal_enabled'] === 'true',
      payment_paypal_username: agentSettings['payment_paypal_username'] as string,
      payment_venmo_enabled: agentSettings['payment_venmo_enabled'] === 'true',
      payment_venmo_username: agentSettings['payment_venmo_username'] as string,
      payment_cashapp_enabled: agentSettings['payment_cashapp_enabled'] === 'true',
      payment_cashapp_username: agentSettings['payment_cashapp_username'] as string,
      payment_zelle_enabled: agentSettings['payment_zelle_enabled'] === 'true',
      payment_zelle_username: agentSettings['payment_zelle_username'] as string,
      payment_bank_enabled: agentSettings['payment_bank_enabled'] === 'true',
      payment_custom_methods: agentSettings['payment_custom_methods'] as string
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
    // Données supplémentaires pour éviter requêtes
    agentContact: agentContact || undefined,

    // Active Scenario data
    activeScenario: activeScenarioData ? {
      scenarioId: activeScenarioData.scenarioId,
      title: activeScenarioData.scenario.title,
      description: activeScenarioData.scenario.description,
      targetContext: activeScenarioData.scenario.targetContext
    } : undefined
  };

  // Créer le graph
  const graph = new SwarmGraph();

  // ÉTAPE 1: INTENTION (toujours en premier - c'est lui qui décide)
  graph.addNode('intention', intentionNode);

  // ÉTAPE 2: AGENTS OBLIGATOIRES (exécutés en parallèle après intention)
  // Ces agents ne dépendent que de l'intention
  graph.addNode('persona', personaNode, ['intention']);
  graph.addNode('timing', timingNode, ['intention']);
  graph.addNode('phase', phaseNode, ['intention']);
  graph.addNode('style', styleNode, ['intention']);
  graph.addNode('safety', safetyNode, ['intention']);

  // ÉTAPE 3: AGENTS OPTIONNELS (exécutés si besoin, en parallèle)
  graph.addNode('memory', async (state: SwarmState) => {
    console.log('[Swarm][Memory] Always-on memory loading...');
    return await memoryNode(state);
  }, ['intention']);

  graph.addNode('payment', async (state: SwarmState) => {
    if (state.intention?.besoinPayment && profile.paymentRules) {
      console.log('[Swarm][Payment] Need detected, loading payment rules...');
      return await paymentNode(state);
    }
    return { contexts: { ...state.contexts, payment: '' } };
  }, ['intention']);

  graph.addNode('media', async (state: SwarmState) => {
    if (state.intention?.besoinMedia) {
      console.log('[Swarm][Media] Need detected, analyzing media request...');
      return await mediaNode(state);
    }
    console.log('[Swarm][Media] No need, skipping');
    return { contexts: { ...state.contexts, media: '' } };
  }, ['intention']);

  graph.addNode('voice', async (state: SwarmState) => {
    if (state.intention?.besoinVoice || state.lastMessageType === 'voice' || state.lastMessageType === 'ptt') {
      console.log('[Swarm][Voice] Need detected, analyzing voice context...');
      return await voiceNode(state);
    }
    console.log('[Swarm][Voice] No need, skipping');
    return { contexts: { ...state.contexts, voice: '' } };
  }, ['intention']);

  // ÉTAPE 4: RÉPONSE (assemble tout et génère)
  graph.addNode('response', responseNode, [
    'persona', 'timing', 'phase', 'style', 'memory', 'payment', 'media', 'voice', 'safety'
  ]);

  // ÉTAPE 5: VALIDATION (vérifie la cohérence)
  graph.addNode('validation', validationNode, ['response']);

  // Exécuter le graph
  console.log('[Swarm] Executing graph...');
  const finalState = await graph.execute('intention', initialState);

  console.log('[Swarm] Graph execution complete');

  if (finalState.error) {
    console.error('[Swarm] Error during execution:', finalState.error);
  }

  // If Venice failed (no response), throw error to be caught by handler
  if (!finalState.response) {
    console.error('[Swarm] CRITICAL: No response generated (Venice likely failed)')
    throw new Error('VENICE_API_REJECTED: No response from AI')
  }

  return finalState.response;
}
