import { venice } from '@/lib/venice'
import type { SwarmState } from '../types'

const FORBIDDEN_CHARS_REGEX =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0400-\u04FF\u0530-\u058F\u0590-\u05FF\u10A0-\u10FF\u2C00-\u2C5F\u2D00-\u2D2F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF]/

const HARD_CONSTRAINT_PATTERNS: Array<{ regex: RegExp; issue: string }> = [
  { regex: /\b(tiktok|instagram|snapchat)\b/i, issue: 'Forbidden social network mention' },
  { regex: /\b(i play|je joue|gaming|fortnite|fifa|minecraft|ps5)\b/i, issue: 'Forbidden gaming claim' },
  { regex: /\b(i can call|je peux appeler|appel video|video call|on s[\' ]?appelle)\b/i, issue: 'Forbidden call claim' },
  { regex: /\b(i can come|let\'s meet|on se voit|rendez[- ]?vous|je peux venir)\b/i, issue: 'Forbidden meeting acceptance' },
  { regex: /\b(my number is|mon numero est|phone number|adresse est|address is)\b/i, issue: 'Forbidden private info leak' }
]

const ASSISTANT_CLICHE_PATTERNS: Array<{ regex: RegExp; issueFr: string; issueEn: string }> = [
  {
    regex: /\bhow\s+can\s+i\s+(help|assist)\s+you\b/i,
    issueFr: 'Interdit: cliché assistant',
    issueEn: 'Forbidden assistant cliche'
  },
  {
    regex: /\bwhat\s+do\s+you\s+want\s+to\s+talk\s+about\b/i,
    issueFr: 'Interdit: cliché assistant',
    issueEn: 'Forbidden assistant cliche'
  },
  {
    regex: /\bcomment\s+puis[- ]?je\s+t[\' ]?aider\b/i,
    issueFr: 'Interdit: cliché assistant',
    issueEn: 'Forbidden assistant cliche'
  },
  {
    regex: /\bde\s+quoi\s+veux[- ]?tu\s+parler\b/i,
    issueFr: 'Interdit: cliché assistant',
    issueEn: 'Forbidden assistant cliche'
  }
]

const MEETING_REQUEST_REGEX =
  /\b(on se voit|on se capte|rendez[- ]?vous|rdv|viens? me voir|let\'s meet|meet(?: up)?|irl)\b/i
const MEETING_ACCEPT_SHORT_REGEX =
  /^(ok+|oui+|yes|yeah|yep|sure|d[\' ]?accord|ca marche|ça marche|vas[- ]?y|why not|sounds good)[!.? ]*$/i

function containsForbiddenChars(text: string): boolean {
  return FORBIDDEN_CHARS_REGEX.test(text)
}

function detectHardConstraintViolations(text: string): string[] {
  return HARD_CONSTRAINT_PATTERNS.filter((entry) => entry.regex.test(text)).map((entry) => entry.issue)
}

function detectAssistantCliches(text: string, isFrench: boolean): string[] {
  return ASSISTANT_CLICHE_PATTERNS.filter((entry) => entry.regex.test(text)).map((entry) => (isFrench ? entry.issueFr : entry.issueEn))
}

function detectMeetingAcceptance(userMessage: string, aiResponse: string, isFrench: boolean): string[] {
  if (!MEETING_REQUEST_REGEX.test(userMessage || '')) return []
  if (MEETING_ACCEPT_SHORT_REGEX.test((aiResponse || '').trim())) {
    return [isFrench ? 'Interdit: acceptation implicite de rencontre' : 'Forbidden: implicit meeting acceptance']
  }
  return []
}

function deterministicValidation(state: SwarmState, response: string, isFrench: boolean): string[] {
  const issues: string[] = []

  if (containsForbiddenChars(response)) {
    issues.push(isFrench ? 'Interdit: caractères non latins' : 'Forbidden non latin characters')
  }

  issues.push(...detectHardConstraintViolations(response))
  issues.push(...detectAssistantCliches(response, isFrench))
  issues.push(...detectMeetingAcceptance(state.userMessage, response, isFrench))

  return Array.from(new Set(issues))
}

async function runLlmValidation(state: SwarmState, response: string, isFrench: boolean) {
  const recentHistory = state.messages.slice(-20)
  const historyText = recentHistory
    .map((h) => `${h.role === 'user' ? 'USER' : 'AI'}: ${h.content}`)
    .join('\n')

  const validationPrompt = isFrench
    ? `Tu es un superviseur strict qui verifie une reponse IA.

HISTORIQUE:
${historyText}

MESSAGE UTILISATEUR:
"${state.userMessage}"

REPONSE IA:
"${response}"

Reponds UNIQUEMENT en JSON:
{
  "isValid": boolean,
  "issues": string[],
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "suggestion": string | null
}`
    : `You are a strict supervisor validating an AI response.

HISTORY:
${historyText}

USER MESSAGE:
"${state.userMessage}"

AI RESPONSE:
"${response}"

Reply only in JSON:
{
  "isValid": boolean,
  "issues": string[],
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "suggestion": string | null
}`

  const validation = await venice.chatCompletion(validationPrompt, [], 'Validate response', {
    apiKey: state.settings.venice_api_key,
    model: state.settings.venice_model || 'google-gemma-3-27b-it',
    temperature: 0.1,
    max_tokens: 260
  })

  const cleanJson = validation.replace(/```json/g, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(cleanJson) as {
    isValid: boolean
    issues?: string[]
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    suggestion?: string | null
  }

  return parsed
}

async function runLlmCorrection(state: SwarmState, currentResponse: string, issues: string[], isFrench: boolean) {
  const promptParts: string[] = []

  promptParts.push(
    isFrench
      ? `REGLE CRITIQUE: Reste en personnage ado, jamais assistante.`
      : `CRITICAL RULE: Stay in teen persona, never assistant-like.`
  )

  if (state.contexts.timing) promptParts.push(state.contexts.timing)
  if (state.contexts.persona) promptParts.push(state.contexts.persona)
  if (state.contexts.phase) promptParts.push(state.contexts.phase)
  if (state.contexts.style) promptParts.push(state.contexts.style)
  if (state.contexts.knownFacts) promptParts.push(state.contexts.knownFacts)
  if (state.contexts.memory) promptParts.push(state.contexts.memory)
  if (state.contexts.payment) promptParts.push(state.contexts.payment)
  if (state.contexts.media) promptParts.push(state.contexts.media)
  if (state.contexts.voice) promptParts.push(state.contexts.voice)
  if (state.contexts.safety) promptParts.push(state.contexts.safety)

  promptParts.push(
    isFrench
      ? `CORRECTION NECESSAIRE: la reponse \"${currentResponse}\" est invalide pour ces raisons:\n${issues
          .map((issue) => `- ${issue}`)
          .join('\n')}\n\nReponds au message utilisateur sans ces erreurs.`
      : `CORRECTION REQUIRED: response \"${currentResponse}\" is invalid for these reasons:\n${issues
          .map((issue) => `- ${issue}`)
          .join('\n')}\n\nReply to user without these errors.`
  )

  return venice.chatCompletion(promptParts.join('\n\n'), state.messages.slice(-12), state.userMessage, {
    apiKey: state.settings.venice_api_key,
    model: state.settings.venice_model || 'google-gemma-3-27b-it',
    temperature: 0.4,
    max_tokens: 80
  })
}

export async function validationNode(state: SwarmState): Promise<Partial<SwarmState>> {
  const { response, settings } = state
  const metadata = state.metadata || {}
  const locale = (state.profile?.locale || settings?.locale || 'fr').toLowerCase()
  const isFrench = locale.startsWith('fr')

  if (!response) return {}

  const deterministicIssues = deterministicValidation(state, response, isFrench)
  const llmValidationEnabled = settings.validation_llm_enabled === true

  if (deterministicIssues.length === 0 && !llmValidationEnabled) {
    return {
      response,
      metadata: {
        ...metadata,
        validationSource: 'deterministic',
        validationIssues: []
      }
    }
  }

  if (deterministicIssues.length > 0 && !llmValidationEnabled) {
    console.warn('[Swarm][Validation] Deterministic issues detected (LLM validation disabled):', deterministicIssues)
    return {
      response,
      metadata: {
        ...metadata,
        validationSource: 'deterministic',
        validationIssues: deterministicIssues
      }
    }
  }

  try {
    const llmResult = await runLlmValidation(state, response, isFrench)
    const allIssues = Array.from(new Set([...(llmResult.issues || []), ...deterministicIssues]))
    const isValid = llmResult.isValid && allIssues.length === 0

    if (isValid) {
      return {
        response,
        metadata: {
          ...metadata,
          validationSource: 'deterministic+llm',
          validationIssues: [],
          llmCallsThisTurn: ((metadata.llmCallsThisTurn as number) || 0) + 1
        }
      }
    }

    const corrected = await runLlmCorrection(state, response, allIssues, isFrench)

    return {
      response: corrected.trim(),
      metadata: {
        ...metadata,
        validationSource: 'deterministic+llm-corrected',
        validationIssues: allIssues,
        llmCallsThisTurn: ((metadata.llmCallsThisTurn as number) || 0) + 2
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Swarm][Validation] LLM validation error:', errorMessage)

    return {
      response,
      metadata: {
        ...metadata,
        validationSource: 'deterministic-fallback',
        validationIssues: deterministicIssues
      }
    }
  }
}
