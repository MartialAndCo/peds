import { SwarmState } from '../types';
import { memoryService } from '@/lib/memory';

export async function memoryNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] memoryNode: Extraction mémoires');

  const phone = (state as any).contactPhone || state.contactId;
  const userId = memoryService.buildUserId(phone, state.agentId);

  console.log(`[Swarm][Memory] userId: ${userId}, phone: ${phone}`);

  let memories: string[] = [];
  try {
    // 1. Search relevant memories using the last user message as query
    const lastUserMsg = state.history
      ?.filter(h => h.role === 'user')
      .pop()?.content || '';

    let searchResults: any[] = [];
    if (lastUserMsg.length > 3) {
      searchResults = await memoryService.search(userId, lastUserMsg);
      console.log(`[Swarm][Memory] Search for "${lastUserMsg.substring(0, 40)}..." returned ${searchResults.length} results`);
    }

    // 2. Also get all memories for completeness (critical facts like age, city)
    const allMemories = await memoryService.getAll(userId);
    console.log(`[Swarm][Memory] Total memories stored: ${allMemories.length}`);

    // 3. Merge: search results first (most relevant), then fill with allMemories
    const searchTexts = (searchResults as any[])
      .map((m: any) => typeof m === 'string' ? m : m.memory)
      .filter(Boolean);

    const allTexts = (allMemories as any[])
      .map((m: any) => typeof m === 'string' ? m : m.memory)
      .filter(Boolean);

    // Deduplicate: search results first, then add from allMemories if not already present
    const seen = new Set<string>();
    const merged: string[] = [];

    for (const text of [...searchTexts, ...allTexts]) {
      const normalized = text.toLowerCase().trim();
      if (!seen.has(normalized) && merged.length < 15) {
        seen.add(normalized);
        merged.push(text);
      }
    }

    memories = merged;
    console.log(`[Swarm][Memory] Final memories injected: ${memories.length} (search: ${searchTexts.length}, all: ${allTexts.length})`);
  } catch (e) {
    console.warn('[Swarm][Memory] Failed to retrieve memories:', e);
  }

  const memoryContext = memories.length > 0
    ? `[INFOS CONNUES SUR ${state.userName || 'CETTE PERSONNE'}]:\n${memories.map(m => `- ${m}`).join('\n')}\n\n⚠️ RÈGLE ABSOLUE: Ne JAMAIS redemander une info déjà listée ci-dessus (âge, ville, prénom, etc.). Si tu as l'info, utilise-la directement.`
    : '';

  return {
    contexts: {
      ...state.contexts,
      memory: memoryContext
    }
  };
}

