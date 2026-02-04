import { SwarmState, IntentionResult } from './types';
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
  responseNode
} from './nodes';

export async function runSwarm(
  userMessage: string,
  history: any[],
  contactId: string,
  agentId: string,
  userName: string,
  lastMessageType?: string
): Promise<string> {
  console.log(`[Swarm] Starting swarm for agent ${agentId}, contact ${contactId}`);
  console.log(`[Swarm] Message: "${userMessage.substring(0, 50)}..."`);
  
  const graph = new SwarmGraph();
  
  // Node 1: Détection d'intention
  graph.addNode('intention', async (state: SwarmState) => {
    const result = await intentionNode(state);
    // Fallback complet si l'intention est manquante ou incomplète
    const fullIntention = result.intention && result.intention.urgence !== undefined 
      ? result.intention 
      : {
          intention: 'general' as const,
          sousIntention: 'question' as const,
          urgence: 'normal' as const,
          besoinTiming: true,
          besoinMemoire: false,
          besoinPhase: false,
          besoinPayment: false,
          besoinMedia: false,
          besoinVoice: false,
          confiance: 0.5
        };
    return { ...result, intention: fullIntention };
  });
  
  // Nodes de contexte (parallèles selon l'intention)
  graph.addNode('timing', timingNode);
  graph.addNode('persona', personaNode);
  graph.addNode('style', styleNode);
  graph.addNode('phase', phaseNode);
  graph.addNode('memory', memoryNode);
  graph.addNode('payment', paymentNode);
  graph.addNode('media', mediaNode);
  graph.addNode('voice', voiceNode);
  graph.addNode('response', responseNode);
  
  // Définition des edges (transitions)
  
  // Depuis intention
  graph.addEdge('intention', 'timing'); // Toujours besoin du timing
  graph.addEdge('intention', 'persona'); // Toujours besoin de l'identité
  graph.addEdge('intention', 'style'); // Toujours besoin du style
  
  // Conditionnels depuis intention
  graph.addEdge('intention', 'phase', (state) => 
    state.intention?.besoinPhase !== false
  );
  graph.addEdge('intention', 'memory', (state) => 
    state.intention?.besoinMemoire === true
  );
  graph.addEdge('intention', 'payment', (state) => 
    state.intention?.intention === 'paiement' || 
    state.userMessage.toLowerCase().includes('paypal') ||
    state.userMessage.toLowerCase().includes('argent') ||
    state.userMessage.toLowerCase().includes('money') ||
    state.userMessage.toLowerCase().includes('send')
  );
  graph.addEdge('intention', 'media', (state) => 
    state.intention?.intention === 'photo' ||
    state.userMessage.toLowerCase().includes('photo') ||
    state.userMessage.toLowerCase().includes('pic') ||
    state.userMessage.toLowerCase().includes('image') ||
    state.userMessage.toLowerCase().includes('selfie')
  );
  graph.addEdge('intention', 'voice', (state) => 
    state.intention?.intention === 'vocal' ||
    state.lastMessageType === 'voice' ||
    state.lastMessageType === 'ptt'
  );
  
  // Rassemblement vers response (tous les chemins mènent à response)
  graph.addEdge('timing', 'response');
  graph.addEdge('persona', 'response');
  graph.addEdge('style', 'response');
  graph.addEdge('phase', 'response');
  graph.addEdge('memory', 'response');
  graph.addEdge('payment', 'response');
  graph.addEdge('media', 'response');
  graph.addEdge('voice', 'response');
  
  // État initial
  const initialState: SwarmState = {
    userMessage,
    history,
    contactId,
    agentId,
    userName,
    lastMessageType: lastMessageType || 'text',
    contexts: {}
  };
  
  // Exécution
  console.log('[Swarm] Executing graph...');
  const finalState = await graph.execute('intention', initialState);
  
  if (!finalState.response) {
    throw new Error('Swarm did not generate a response');
  }
  
  console.log(`[Swarm] Response generated: "${finalState.response.substring(0, 50)}..."`);
  return finalState.response;
}

export * from './types';
export { SwarmGraph } from './graph';
