import { SwarmState } from '../types';
import { memoryService } from '@/lib/memory';

export async function memoryNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] memoryNode: Extraction mémoires');
  
  // Utiliser contactPhone si disponible, sinon contactId (pour compatibilité)
  const phone = (state as any).contactPhone || state.contactId;
  const userId = memoryService.buildUserId(phone, state.agentId);
  
  console.log(`[Swarm][Memory] Looking for userId: ${userId}`);
  console.log(`[Swarm][Memory] Using phone: ${phone}`);
  
  // Si une query est fournie, faire une recherche pertinente
  let memories: string[] = [];
  try {
    const allMemories = await memoryService.getAll(userId);
    console.log(`[Swarm][Memory] Found ${allMemories.length} raw memories`);
    memories = (allMemories as any[]).map((m: any) => typeof m === 'string' ? m : m.memory).filter(Boolean).slice(0, 5);
    console.log(`[Swarm][Memory] Processed ${memories.length} memories:`, memories);
  } catch (e) {
    console.warn('[Swarm][Memory] Failed to retrieve memories:', e);
  }
  
  const memoryContext = memories.length > 0
    ? `[INFOS SUR ${state.userName || 'CETTE PERSONNE'}]:\n${memories.map(m => `- ${m}`).join('\n')}`
    : '';
  
  return {
    contexts: {
      ...state.contexts,
      memory: memoryContext
    }
  };
}
