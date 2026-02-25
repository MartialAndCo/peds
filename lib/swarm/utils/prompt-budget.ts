export interface Section {
  id: string
  priority: number
  maxChars?: number
  content: string
}

interface NormalizedSection extends Section {
  index: number
  content: string
}

const LOCKED_SECTION_IDS = new Set(['system-constraints'])
const HISTORY_SECTION_ID = 'conversation-history'
const MIN_SECTION_CHARS = 120

function truncateToChars(text: string, maxChars: number): string {
  if (maxChars <= 0) return ''
  if (text.length <= maxChars) return text

  const slice = text.slice(0, maxChars)
  const lastBreak = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf(' '))
  const safe = lastBreak > Math.floor(maxChars * 0.6) ? slice.slice(0, lastBreak) : slice
  return `${safe.trimEnd()}...`
}

function formatPrompt(sections: NormalizedSection[]): string {
  return sections
    .map((section) => section.content.trim())
    .filter((content) => content.length > 0)
    .join('\n\n')
}

function sortByPriority(sections: NormalizedSection[]): NormalizedSection[] {
  return [...sections].sort((a, b) => {
    if (a.priority === b.priority) return a.index - b.index
    return b.priority - a.priority
  })
}

function findDroppableLowestPriorityIndex(sections: NormalizedSection[]): number {
  let candidateIndex = -1
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i]
    if (LOCKED_SECTION_IDS.has(section.id)) continue

    if (candidateIndex === -1) {
      candidateIndex = i
      continue
    }

    const currentCandidate = sections[candidateIndex]
    if (
      section.priority < currentCandidate.priority ||
      (section.priority === currentCandidate.priority && section.index > currentCandidate.index)
    ) {
      candidateIndex = i
    }
  }

  return candidateIndex
}

function shrinkHistorySection(sections: NormalizedSection[]): boolean {
  const historySection = sections.find((section) => section.id === HISTORY_SECTION_ID)
  if (!historySection) return false

  if (historySection.content.length <= MIN_SECTION_CHARS) {
    return false
  }

  const nextMax = Math.max(MIN_SECTION_CHARS, Math.floor(historySection.content.length * 0.75))
  historySection.content = truncateToChars(historySection.content, nextMax)
  return true
}

function shrinkNonLockedSection(sections: NormalizedSection[], overflowChars: number): boolean {
  const candidates = sections
    .filter((section) => !LOCKED_SECTION_IDS.has(section.id))
    .sort((a, b) => {
      if (a.priority === b.priority) return b.content.length - a.content.length
      return a.priority - b.priority
    })

  const candidate = candidates[0]
  if (!candidate) return false

  if (candidate.content.length <= MIN_SECTION_CHARS) {
    const index = sections.findIndex((section) => section.id === candidate.id && section.index === candidate.index)
    if (index >= 0) {
      sections.splice(index, 1)
      return true
    }
    return false
  }

  const nextMax = Math.max(MIN_SECTION_CHARS, candidate.content.length - overflowChars)
  candidate.content = truncateToChars(candidate.content, nextMax)
  return true
}

export function buildBudgetedPrompt(sections: Section[], maxChars: number): string {
  if (!Array.isArray(sections) || sections.length === 0) return ''

  const normalized = sortByPriority(
    sections
      .map((section, index) => {
        const content = typeof section.content === 'string' ? section.content.trim() : ''
        if (!content) return null

        const maxPerSection =
          typeof section.maxChars === 'number' && section.maxChars > 0 ? section.maxChars : Number.POSITIVE_INFINITY

        return {
          ...section,
          index,
          content: Number.isFinite(maxPerSection) ? truncateToChars(content, maxPerSection) : content
        }
      })
      .filter((section): section is NormalizedSection => section !== null)
  )

  if (normalized.length === 0) return ''

  const working = [...normalized]
  let prompt = formatPrompt(working)

  if (maxChars > 0 && prompt.length <= maxChars) {
    return prompt
  }

  // Step 1: drop lowest priority sections first.
  while (maxChars > 0 && prompt.length > maxChars) {
    const dropIndex = findDroppableLowestPriorityIndex(working)
    if (dropIndex < 0) break

    working.splice(dropIndex, 1)
    prompt = formatPrompt(working)
  }

  // Step 2: shrink history window before shrinking critical sections.
  while (maxChars > 0 && prompt.length > maxChars) {
    const shrunk = shrinkHistorySection(working)
    if (!shrunk) break
    prompt = formatPrompt(working)
  }

  // Step 3: final bounded shrinking for remaining non-locked sections.
  while (maxChars > 0 && prompt.length > maxChars) {
    const overflow = prompt.length - maxChars
    const shrunk = shrinkNonLockedSection(working, Math.max(overflow, 64))
    if (!shrunk) break
    prompt = formatPrompt(working)
  }

  // Hard fallback: keep locked sections and trim to absolute cap if necessary.
  if (maxChars > 0 && prompt.length > maxChars) {
    const lockedOnly = working.filter((section) => LOCKED_SECTION_IDS.has(section.id))
    const lockedPrompt = formatPrompt(lockedOnly)

    if (lockedPrompt.length > 0) {
      return truncateToChars(lockedPrompt, maxChars)
    }

    return truncateToChars(prompt, maxChars)
  }

  return prompt
}
