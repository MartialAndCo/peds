import { SwarmState } from '../types'
import { memoryService } from '@/lib/memory'

const MAX_MEMORY_ITEMS = 6
const MAX_MEMORY_ENTRY_CHARS = 160
const MAX_MEMORY_CONTEXT_CHARS = 1000

function normalizeMemoryText(raw: string): string {
  const compact = raw.replace(/\s+/g, ' ').trim()
  if (compact.length <= MAX_MEMORY_ENTRY_CHARS) return compact
  return `${compact.slice(0, MAX_MEMORY_ENTRY_CHARS)}...`
}

export async function memoryNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] memoryNode: extraction memories')

  const phone = state.contactPhone || state.contactId
  const userId = memoryService.buildUserId(phone, state.agentId)

  console.log(`[Swarm][Memory] userId: ${userId}, phone: ${phone}`)

  let memories: string[] = []
  try {
    const fallbackQuery = state.history.filter((h) => h.role === 'user').pop()?.content || ''
    const lastUserMsg = (state.userMessage || fallbackQuery).trim()

    let searchResults: any[] = []
    if (lastUserMsg.length > 2) {
      searchResults = await memoryService.search(userId, lastUserMsg)
      console.log(
        `[Swarm][Memory] Search for "${lastUserMsg.substring(0, 40)}..." returned ${searchResults.length} results`
      )
    }

    const searchTexts = (searchResults as any[])
      .map((m: any) => (typeof m === 'string' ? m : m.memory))
      .filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0)

    let allTexts: string[] = []
    if (searchTexts.length < 3) {
      const allMemories = await memoryService.getAll(userId)
      console.log(`[Swarm][Memory] Total memories stored: ${allMemories.length}`)

      allTexts = (allMemories as any[])
        .map((m: any) => (typeof m === 'string' ? m : m.memory))
        .filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0)
    }

    const seen = new Set<string>()
    const merged: string[] = []
    let totalChars = 0

    for (const text of [...searchTexts, ...allTexts]) {
      const normalizedKey = text.toLowerCase().trim().replace(/\s+/g, ' ')
      if (seen.has(normalizedKey)) continue

      const compact = normalizeMemoryText(text)
      const projectedChars = totalChars + compact.length
      if (merged.length >= MAX_MEMORY_ITEMS || projectedChars > MAX_MEMORY_CONTEXT_CHARS) {
        break
      }

      seen.add(normalizedKey)
      merged.push(compact)
      totalChars = projectedChars
    }

    memories = merged
    console.log(
      `[Swarm][Memory] Final memories injected: ${memories.length} (search: ${searchTexts.length}, all: ${allTexts.length}, chars: ${totalChars})`
    )
  } catch (e) {
    console.warn('[Swarm][Memory] Failed to retrieve memories:', e)
  }

  let memoryContext =
    memories.length > 0
      ? `[MEMOIRE CONTEXTUELLE ${state.userName || 'CETTE PERSONNE'}]:\n${memories
          .map((m) => `- ${m}`)
          .join('\n')}\n\nRULE ABSOLUE: Ne JAMAIS redemander une info deja listee ci-dessus (age, ville, prenom, etc.). Si tu as l'info, utilise-la directement.`
      : ''

  if (memoryContext.length > MAX_MEMORY_CONTEXT_CHARS) {
    memoryContext = `${memoryContext.slice(0, MAX_MEMORY_CONTEXT_CHARS)}...`
  }

  return {
    contexts: {
      ...state.contexts,
      memory: memoryContext
    }
  }
}
