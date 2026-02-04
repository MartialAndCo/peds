import { SwarmState } from '../types';
import { memoryService } from '@/lib/memory';

export async function memoryNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] memoryNode: Extraction mémoires');
  
  const userId = memoryService.buildUserId(state.contactId, state.agentId);
  
  // Si une query est fournie, faire une recherche pertinente
  let memories: string[] = [];
  try {
    if (state.userMessage && state.userMessage.length > 3) {
      const searchResults = await memoryService.search(userId, state.userMessage);
      memories = (searchResults as any[]).map((m: any) => typeof m === 'string' ? m : m.memory).filter(Boolean).slice(0, 5);
    } else {
      const allMemories = await memoryService.getAll(userId);
      memories = (allMemories as any[]).map((m: any) => typeof m === 'string' ? m : m.memory).filter(Boolean).slice(0, 5);
    }
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
