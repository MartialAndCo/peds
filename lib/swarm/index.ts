import { prisma } from '@/lib/prisma';
import { SwarmGraph } from './graph';
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
  responseNode,
  validationNode 
} from './nodes';
import type { SwarmState, IntentionResult } from './types';

// NOTE: API key is now fetched from DB (settings) not env var, to allow hot-swapping

export async function runSwarm(
  userMessage: string,
  history: any[],
  contactId: string,
  agentId: string,
  userName: string,
  lastMessageType?: string
): Promise<string> {
  console.log(`[Swarm] Starting swarm for: "${userMessage.substring(0, 50)}..."`);
  console.log(`[Swarm] Contact: ${contactId}, Agent: ${agentId}`);

  // Récupérer le contact pour avoir le phone (nécessaire pour les mémoires)
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { phone_whatsapp: true }
  });
  
  const contactPhone = contact?.phone_whatsapp || contactId; // Fallback sur ID si pas trouvé

  // Récupérer le profil complet
  const profile = await prisma.agentProfile.findUnique({
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
      locale: true
    }
  });

  if (!profile) throw new Error('Profile not found');

  // Récupérer la clé API Venice depuis la DB (pas l'env var)
  const veniceKeySetting = await prisma.setting.findUnique({
    where: { key: 'venice_api_key' }
  });
  const veniceApiKey = veniceKeySetting?.value || process.env.VENICE_API_KEY || '';

  // Récupérer la phase
  const agentContact = await prisma.agentContact.findFirst({
    where: { agentId, contactId },
    select: { phase: true }
  });

  const phase = agentContact?.phase || 'CONNECTION';

  // Récupérer la conversation active pour le leadContext (Smart Add)
  const activeConversation = await prisma.conversation.findFirst({
    where: { 
      contactId, 
      agentId,
      status: { in: ['active', 'paused'] }
    },
    select: { metadata: true }
  });

  // Extraire le leadContext si présent (cast to any for Prisma JSON type)
  const metadata = activeConversation?.metadata as any
  const leadContext = metadata?.leadContext || metadata?.previousContext
  const leadPlatform = metadata?.platform || 'previous platform'

  // Initial state
  const initialState: SwarmState = {
    userMessage,
    history,
    contactId,
    contactPhone,  // Pour les mémoires
    agentId,
    userName,
    lastMessageType: lastMessageType || 'text',
    settings: { 
      venice_api_key: veniceApiKey, 
      venice_model: 'venice-uncensored',
      timezone: profile.timezone || 'Europe/Paris',
      locale: profile.locale || 'fr-FR'
    },
    contexts: {
      persona: '',
      style: profile.styleRules || '',
      phase: '',
      timing: '',
      memory: '',
      payment: '',
      media: '',
      voice: '',
      lead: leadContext ? `[IMPORTED FROM ${leadPlatform.toUpperCase()}]: ${leadContext}` : ''
    },
    profile,
    currentPhase: phase,
    leadContext: leadContext || undefined
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
  graph.addNode('style', styleNode, ['intention']); // OBLIGATOIRE pour éviter les paragraphes

  // ÉTAPE 3: AGENTS OPTIONNELS (exécutés si besoin, en parallèle)
  // Dépendent de l'intention détectée
  graph.addNode('memory', async (state: SwarmState) => {
    if (state.intention?.besoinMemoire) {
      console.log('[Swarm][Memory] Need detected, loading memories...');
      return await memoryNode(state);
    }
    console.log('[Swarm][Memory] No need, skipping');
    return { contexts: { ...state.contexts, memory: '' } };
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
  // Dépend de tous les agents précédents
  graph.addNode('response', responseNode, [
    'persona', 'timing', 'phase', 'style', 'memory', 'payment', 'media', 'voice'
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
