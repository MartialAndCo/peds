import { venice } from '@/lib/venice'
import { logger } from '@/lib/logger'

type LengthGuardAction = 'pass' | 'condensed' | 'blocked'

export type LengthGuardResult = {
    status: 'ok' | 'blocked'
    text: string
    reason?: string
    metrics: {
        source: string
        action: LengthGuardAction
        attempt: number
        beforeWords: number
        afterWords: number
        beforeBubbles: number
        afterBubbles: number
    }
}

type EnforceLengthInput = {
    text: string
    locale?: string | null
    apiKey?: string | null
    source: string
    maxWordsPerBubble?: number
    maxBubbles?: number
    attempt?: number
}

type LengthAnalysis = {
    normalizedText: string
    bubbles: string[]
    wordsPerBubble: number[]
    totalWords: number
    bubbleCount: number
    exceedsLimit: boolean
}

const ALLOWED_TAG_REGEX = /^\[(?:IMAGE:[^\]]+|VIDEO:[^\]]+|VOICE|REACT:[^\]]+|PAYMENT_RECEIVED|VERIFY_PAYMENT|VERIFIER_PAIEMENT|PAIEMENT_REÇU|PAIEMENT_RECU)\]$/i
const FUNCTIONAL_TAG_REGEX = /\[(?:IMAGE:[^\]]+|VIDEO:[^\]]+|VOICE|REACT:[^\]]+|PAYMENT_RECEIVED|VERIFY_PAYMENT|VERIFIER_PAIEMENT|PAIEMENT_REÇU|PAIEMENT_RECU)\]/gi
const BRACKET_TAG_REGEX = /\[[^\]]+\]/g

function splitBubbles(text: string): string[] {
    const normalized = text.replace(/\r/g, '').trim()
    if (!normalized) return []

    let parts = normalized.split(/\|+/).map((part) => part.trim()).filter(Boolean)
    if (parts.length <= 1) {
        const newlineParts = normalized.split(/\n+/).map((part) => part.trim()).filter(Boolean)
        if (newlineParts.length > 1) {
            parts = newlineParts
        }
    }

    return parts
}

function normalizeBubbles(text: string): string {
    const parts = splitBubbles(text)
    return parts.join('|||').trim()
}

function normalizeTagKey(tag: string): string {
    const upper = tag.trim().toUpperCase()
    if (upper === '[VERIFIER_PAIEMENT]') return '[VERIFY_PAYMENT]'
    if (upper === '[PAIEMENT_REÇU]' || upper === '[PAIEMENT_RECU]') return '[PAYMENT_RECEIVED]'
    return upper
}

function buildTagCountMap(tags: string[]): Map<string, number> {
    const map = new Map<string, number>()
    for (const tag of tags) {
        const key = normalizeTagKey(tag)
        map.set(key, (map.get(key) || 0) + 1)
    }
    return map
}

function extractFunctionalTags(text: string): string[] {
    return text.match(FUNCTIONAL_TAG_REGEX) || []
}

function containsUnsupportedTag(text: string): boolean {
    const tags = text.match(BRACKET_TAG_REGEX) || []
    return tags.some((tag) => !ALLOWED_TAG_REGEX.test(tag))
}

function keepsRequiredTags(source: string, candidate: string): boolean {
    const sourceTags = buildTagCountMap(extractFunctionalTags(source))
    if (sourceTags.size === 0) return true

    const candidateTags = buildTagCountMap(extractFunctionalTags(candidate))
    for (const [tag, count] of sourceTags.entries()) {
        if ((candidateTags.get(tag) || 0) < count) {
            return false
        }
    }

    return true
}

function countWordsInBubble(text: string): number {
    const withoutTags = text.replace(FUNCTIONAL_TAG_REGEX, ' ')
    const words = withoutTags.match(/[0-9A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’\-][0-9A-Za-zÀ-ÖØ-öø-ÿ]+)*/g)
    return words?.length || 0
}

function analyzeLength(text: string, maxWordsPerBubble: number, maxBubbles: number): LengthAnalysis {
    const normalizedText = normalizeBubbles(text)
    const bubbles = splitBubbles(normalizedText)
    const wordsPerBubble = bubbles.map(countWordsInBubble)
    const totalWords = wordsPerBubble.reduce((sum, value) => sum + value, 0)
    const bubbleCount = bubbles.length
    const exceedsLimit =
        bubbleCount > maxBubbles || wordsPerBubble.some((words) => words > maxWordsPerBubble)

    return {
        normalizedText,
        bubbles,
        wordsPerBubble,
        totalWords,
        bubbleCount,
        exceedsLimit
    }
}

function buildCondensePrompt(locale?: string | null): string {
    const isFrench = locale?.toLowerCase().startsWith('fr')
    const localeInstruction = isFrench
        ? 'Garde strictement la langue du message source (français).'
        : 'Keep strictly the same language as the source message.'

    return `You are a strict chat condenser.
${localeInstruction}

Rules:
1) Maximum 2 bubbles total.
2) Maximum 12 words per bubble.
3) Bubble separator must be exactly: |||
4) Keep all functional tags exactly when present:
[IMAGE:...], [VIDEO:...], [VOICE], [REACT:...], [PAYMENT_RECEIVED], [VERIFY_PAYMENT], [VERIFIER_PAIEMENT].
5) Do not add information. Keep the same intent.
6) No explanations, no markdown, no code fences. Output only the final chat message.`
}

function cleanModelOutput(text: string): string {
    return text
        .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, ''))
        .replace(/^["'`]+|["'`]+$/g, '')
        .trim()
}

async function condenseWithModel(params: {
    text: string
    locale?: string | null
    apiKey?: string | null
}): Promise<string> {
    const { text, locale, apiKey } = params

    const userPrompt = `Source message:
${text}

Return the condensed message now.`

    const completionPromise = venice.chatCompletion(
        buildCondensePrompt(locale),
        [],
        userPrompt,
        {
            apiKey: apiKey || undefined,
            model: 'google-gemma-3-27b-it',
            temperature: 0.1,
            max_tokens: 140,
            frequency_penalty: 0
        }
    )

    const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('condense_timeout')), 12000)
    })

    const raw = await Promise.race([completionPromise, timeoutPromise])
    return cleanModelOutput(raw)
}

function logLengthGuard(metrics: LengthGuardResult['metrics']) {
    logger.info('Length guard decision', {
        module: 'response-length-guard',
        ...metrics
    })
}

export async function enforceLength(input: EnforceLengthInput): Promise<LengthGuardResult> {
    const {
        text,
        locale,
        apiKey,
        source,
        maxWordsPerBubble = 12,
        maxBubbles = 2,
        attempt = 1
    } = input

    const safeText = (text || '').trim()
    const before = analyzeLength(safeText, maxWordsPerBubble, maxBubbles)

    if (!safeText) {
        const metrics = {
            source,
            action: 'pass' as const,
            attempt,
            beforeWords: 0,
            afterWords: 0,
            beforeBubbles: 0,
            afterBubbles: 0
        }
        logLengthGuard(metrics)
        return { status: 'ok', text: '', metrics }
    }

    if (!before.exceedsLimit) {
        const metrics = {
            source,
            action: 'pass' as const,
            attempt,
            beforeWords: before.totalWords,
            afterWords: before.totalWords,
            beforeBubbles: before.bubbleCount,
            afterBubbles: before.bubbleCount
        }
        logLengthGuard(metrics)
        return {
            status: 'ok',
            text: before.normalizedText || safeText,
            metrics
        }
    }

    let lastReason = 'condense_failed'
    let lastAfterWords = before.totalWords
    let lastAfterBubbles = before.bubbleCount

    for (let condenseAttempt = 1; condenseAttempt <= 2; condenseAttempt++) {
        try {
            const condensedRaw = await condenseWithModel({ text: safeText, locale, apiKey })
            const condensed = normalizeBubbles(condensedRaw)
            const after = analyzeLength(condensed, maxWordsPerBubble, maxBubbles)

            lastAfterWords = after.totalWords
            lastAfterBubbles = after.bubbleCount

            if (!condensed) {
                lastReason = 'empty_condensed'
                continue
            }
            if (containsUnsupportedTag(condensed)) {
                lastReason = 'unsupported_tag'
                continue
            }
            if (!keepsRequiredTags(safeText, condensed)) {
                lastReason = 'missing_functional_tags'
                continue
            }
            if (after.exceedsLimit) {
                lastReason = 'still_too_long'
                continue
            }

            const metrics = {
                source,
                action: 'condensed' as const,
                attempt: condenseAttempt,
                beforeWords: before.totalWords,
                afterWords: after.totalWords,
                beforeBubbles: before.bubbleCount,
                afterBubbles: after.bubbleCount
            }
            logLengthGuard(metrics)
            return {
                status: 'ok',
                text: after.normalizedText,
                metrics
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : ''
            lastReason = errorMessage === 'condense_timeout' ? 'condense_timeout' : 'condense_error'
        }
    }

    const metrics = {
        source,
        action: 'blocked' as const,
        attempt,
        beforeWords: before.totalWords,
        afterWords: lastAfterWords,
        beforeBubbles: before.bubbleCount,
        afterBubbles: lastAfterBubbles
    }
    logLengthGuard(metrics)
    return {
        status: 'blocked',
        text: before.normalizedText || safeText,
        reason: lastReason,
        metrics
    }
}
