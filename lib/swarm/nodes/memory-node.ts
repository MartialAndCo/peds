import { SwarmState } from '../types';
import { memoryService } from '@/lib/memory';

export async function memoryNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] memoryNode: extraction memories');

  const phone = (state as any).contactPhone || state.contactId;
  const userId = memoryService.buildUserId(phone, state.agentId);

  console.log(`[Swarm][Memory] userId: ${userId}, phone: ${phone}`);

  let memories: string[] = [];
  try {
    // 1) Query-focused search first
    const lastUserMsg = (state.userMessage || state.history?.filter(h => h.role === 'user').pop()?.content || '').trim();

    let searchResults: any[] = [];
    if (lastUserMsg.length > 2) {
      searchResults = await memoryService.search(userId, lastUserMsg);
      console.log(`[Swarm][Memory] Search for "${lastUserMsg.substring(0, 40)}..." returned ${searchResults.length} results`);
    }

    const searchTexts = (searchResults as any[])
      .map((m: any) => typeof m === 'string' ? m : m.memory)
      .filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0);

    // 2) Light fallback only if search is weak
    let allTexts: string[] = [];
    if (searchTexts.length < 3) {
      const allMemories = await memoryService.getAll(userId);
      console.log(`[Swarm][Memory] Total memories stored: ${allMemories.length}`);

      allTexts = (allMemories as any[])
        .map((m: any) => typeof m === 'string' ? m : m.memory)
        .filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0)
        .slice(0, 5);
    }

    // 3) Deduplicate and keep compact to avoid prompt bloat
    const seen = new Set<string>();
    const merged: string[] = [];

    for (const text of [...searchTexts, ...allTexts]) {
      const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
      if (!seen.has(normalized) && merged.length < 6) {
        seen.add(normalized);
        const compact = text.replace(/\s+/g, ' ').trim();
        merged.push(compact.length > 140 ? `${compact.slice(0, 140)}...` : compact);
      }
    }

    memories = merged;
    console.log(`[Swarm][Memory] Final memories injected: ${memories.length} (search: ${searchTexts.length}, all: ${allTexts.length})`);
  } catch (e) {
    console.warn('[Swarm][Memory] Failed to retrieve memories:', e);
  }

  const memoryContext = memories.length > 0
    ? `[MEMOIRE CONTEXTUELLE ${state.userName || 'CETTE PERSONNE'}]:\n${memories.map(m => `- ${m}`).join('\n')}\n\nRULE ABSOLUE: Ne JAMAIS redemander une info deja listee ci-dessus (age, ville, prenom, etc.). Si tu as l'info, utilise-la directement.`
    : '';

  return {
    contexts: {
      ...state.contexts,
      memory: memoryContext
    }
  };
}
