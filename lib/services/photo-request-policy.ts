export interface RecentUserMessage {
  text: string
  timestamp?: Date | string | number | null
}

export type PhotoAuthorizationReason =
  | 'allowed_scenario_crisis'
  | 'allowed_recent_request'
  | 'scenario_requires_crisis'
  | 'no_recent_request'
  | 'expired_request'
  | 'request_already_consumed'

export interface EvaluatePhotoAuthorizationParams {
  keyword: string
  phase?: string | null
  recentUserMessages: RecentUserMessage[]
  requestConsumed?: boolean
  now?: Date
  windowMinutes?: number
}

export interface PhotoAuthorizationResult {
  allowed: boolean
  reason: PhotoAuthorizationReason
  requestTimestamp?: Date
}

function parseDate(value: Date | string | number | null | undefined): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return null
}

export function isScenarioImageKeyword(keyword: string): boolean {
  return keyword.trim().toLowerCase().startsWith('scenario_')
}

export function isExplicitPhotoRequest(msg: string): boolean {
  const m = msg.toLowerCase()

  const nonDemandPatterns = [
    /j'ai pris.*photo/,
    /j'ai une photo/,
    /j'ai.*photo/,
    /photo de profil/,
    /belle(s)? photo/,
    /bonne photo/,
    /sur (la|une|cette) photo/,
    /c'est (une|la) photo/,
    /j'aime (la|ta|cette) photo/,
    /j'ai vu.*photo/,
    /ma photo/,
    /mes photos/,
    /photo de (mon|ma|mes)/,
    /la photo (de|du|des)/,
    /une photo de (mon|ma|mes|son|sa|ses)/,
    /i (took|have|had|saw|like|love).*photo/,
    /nice (photo|pic|picture)/,
    /great (photo|pic|picture)/,
    /good (photo|pic|picture)/
  ]

  if (nonDemandPatterns.some((p) => p.test(m))) {
    return false
  }

  const demandVerbs = [
    'envoie', 'envoyer', 'envoi', 'montre', 'montrer', 'donne', 'donner',
    'send', 'show', 'give', 'want', 'veux', 'voudrais', 'peux avoir',
    'can i (see|get|have)', 'fais voir', 'jveux voir', 'je veux voir',
    'tu peux montrer', 'let me see'
  ]

  const photoNouns = ['photo', 'pic', 'picture', 'image', 'img']

  for (const verb of demandVerbs) {
    for (const noun of photoNouns) {
      const pattern = new RegExp(`${verb}.*${noun}|${noun}.*${verb}`, 'i')
      if (pattern.test(m)) return true
    }
  }

  const directPhrases = [
    'une photo de toi', 'photo of you', 'pic of you',
    'montre toi', 'show yourself', 'let me see you',
    'ta photo'
  ]

  if (directPhrases.some((p) => m.includes(p))) return true

  return false
}

export function evaluatePhotoAuthorization(params: EvaluatePhotoAuthorizationParams): PhotoAuthorizationResult {
  const {
    keyword,
    phase,
    recentUserMessages,
    requestConsumed = false,
    now = new Date(),
    windowMinutes = 15
  } = params

  if (isScenarioImageKeyword(keyword)) {
    if ((phase || '').toUpperCase() === 'CRISIS') {
      return { allowed: true, reason: 'allowed_scenario_crisis' }
    }
    return { allowed: false, reason: 'scenario_requires_crisis' }
  }

  const messages = Array.isArray(recentUserMessages) ? recentUserMessages : []
  const normalized = messages.map((item) => ({
    text: item?.text || '',
    timestamp: parseDate(item?.timestamp)
  }))

  const hasAnyTimestamp = normalized.some((m) => m.timestamp)
  const ordered = hasAnyTimestamp
    ? [...normalized].sort((a, b) => (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0))
    : normalized

  const windowMessages = ordered.slice(-3)
  let requestMessage: { text: string; timestamp: Date | null } | null = null

  for (let i = windowMessages.length - 1; i >= 0; i--) {
    const candidate = windowMessages[i]
    if (isExplicitPhotoRequest(candidate.text)) {
      requestMessage = candidate
      break
    }
  }

  if (!requestMessage) {
    return { allowed: false, reason: 'no_recent_request' }
  }

  if (requestMessage.timestamp) {
    const maxAgeMs = windowMinutes * 60 * 1000
    if (now.getTime() - requestMessage.timestamp.getTime() > maxAgeMs) {
      return { allowed: false, reason: 'expired_request', requestTimestamp: requestMessage.timestamp }
    }
  }

  if (requestConsumed) {
    return { allowed: false, reason: 'request_already_consumed', requestTimestamp: requestMessage.timestamp || undefined }
  }

  return {
    allowed: true,
    reason: 'allowed_recent_request',
    requestTimestamp: requestMessage.timestamp || undefined
  }
}
