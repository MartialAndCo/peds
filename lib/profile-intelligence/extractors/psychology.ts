/**
 * Extracteur Psychologique
 * Extrait: traits Big Five, état émotionnel, vulnérabilités
 * CRITIQUE pour l'escalation
 */

import { venice } from '@/lib/venice'
import { PSYCHOLOGY_PROMPT } from '../prompts'
import { robustJsonParse } from '../json-parser'
import { MessageForExtraction, PsychologyExtraction } from '../types'

export async function extractPsychology(
    messages: MessageForExtraction[],
    apiKey?: string,
    model?: string
): Promise<PsychologyExtraction> {
    
    const startTime = Date.now()
    
    const relevantMessages = messages.filter(m => 
        m.sender === 'contact' || m.sender === 'ai'
    )
    
    if (relevantMessages.length === 0) {
        return getEmptyPsychology()
    }
    
    const conversation = relevantMessages
        .map(m => `${m.sender === 'contact' ? 'CONTACT:' : 'AI:'} ${m.text}`)
        .join('\n\n')
    
    try {
        const response = await venice.chatCompletion(
            'You are a psychological profiling AI. Output only valid JSON.',
            [],
            `${PSYCHOLOGY_PROMPT}\n\nCONVERSATION:\n${conversation}\n\nExtract psychology JSON:`,
            {
                apiKey,
                model: model || 'venice-uncensored',
                temperature: 0.25, // Légèrement plus haut pour nuances psychologiques
                max_tokens: 800
            }
        )
        
        const parsed = parsePsychologyResponse(response)
        console.log(`[PsychologyExtractor] Extracted in ${Date.now() - startTime}ms:`, {
            emotionalState: parsed.emotionalState,
            vulnerabilityCount: parsed.vulnerabilities.length,
            redFlagCount: parsed.redFlags.length
        })
        
        return parsed
        
    } catch (error) {
        console.error('[PsychologyExtractor] Failed:', error)
        return getEmptyPsychology()
    }
}

function parsePsychologyResponse(response: string): PsychologyExtraction {
    try {
        const data = robustJsonParse(response)
        if (!data) throw new Error('Failed to parse JSON')
        
        return {
            traits: {
                openness: normalizeTrait(data.traits?.openness),
                conscientiousness: normalizeTrait(data.traits?.conscientiousness),
                extraversion: normalizeTrait(data.traits?.extraversion),
                agreeableness: normalizeTrait(data.traits?.agreeableness),
                neuroticism: normalizeTrait(data.traits?.neuroticism)
            },
            communication: {
                style: normalizeCommunicationStyle(data.communication?.style),
                responseSpeed: normalizeSpeed(data.communication?.responseSpeed),
                verbosity: normalizeVerbosity(data.communication?.verbosity)
            },
            emotionalState: normalizeEmotionalState(data.emotionalState),
            stressors: normalizeArray(data.stressors),
            redFlags: normalizeArray(data.redFlags),
            greenFlags: normalizeArray(data.greenFlags),
            vulnerabilities: normalizeVulnerabilities(data.vulnerabilities)
        }
        
    } catch (error) {
        console.error('[PsychologyExtractor] Parse error:', error)
        return getEmptyPsychology()
    }
}

function getEmptyPsychology(): PsychologyExtraction {
    return {
        traits: {
            openness: undefined,
            conscientiousness: undefined,
            extraversion: undefined,
            agreeableness: undefined,
            neuroticism: undefined
        },
        communication: {
            style: undefined,
            responseSpeed: undefined,
            verbosity: undefined
        },
        emotionalState: undefined,
        stressors: [],
        redFlags: [],
        greenFlags: [],
        vulnerabilities: []
    }
}

function normalizeTrait(value: unknown): number | undefined {
    if (value === null || value === undefined) return undefined
    const num = Number(value)
    if (isNaN(num)) return undefined
    // Clamp entre 1 et 10
    return Math.max(1, Math.min(10, Math.round(num)))
}

function normalizeCommunicationStyle(value: unknown): 'direct' | 'passive' | 'aggressive' | 'manipulative' | 'passive_aggressive' | undefined {
    const str = normalizeString(value)
    if (!str) return undefined
    const lower = str.toLowerCase().replace(/[-_]/g, '_')
    const valid = ['direct', 'passive', 'aggressive', 'manipulative', 'passive_aggressive']
    if (valid.includes(lower)) return lower as any
    
    // Mappings
    if (['frank', 'straightforward', 'honnête'].includes(lower)) return 'direct'
    if (['shy', 'timid', 'reserved', 'quiet'].includes(lower)) return 'passive'
    if (['hostile', 'angry', 'rude'].includes(lower)) return 'aggressive'
    if (['controlling', 'calculating'].includes(lower)) return 'manipulative'
    
    return undefined
}

function normalizeSpeed(value: unknown): 'fast' | 'normal' | 'slow' | 'erratic' | undefined {
    const str = normalizeString(value)
    if (!str) return undefined
    const lower = str.toLowerCase()
    if (['fast', 'quick', 'rapid', 'vite'].includes(lower)) return 'fast'
    if (['slow', 'late', 'takes time', 'lent'].includes(lower)) return 'slow'
    if (['erratic', 'irregular', 'unpredictable'].includes(lower)) return 'erratic'
    if (['normal', 'regular', 'standard'].includes(lower)) return 'normal'
    return undefined
}

function normalizeVerbosity(value: unknown): 'concise' | 'normal' | 'verbose' | undefined {
    const str = normalizeString(value)
    if (!str) return undefined
    const lower = str.toLowerCase()
    if (['concise', 'brief', 'short', 'succinct', 'court'].includes(lower)) return 'concise'
    if (['verbose', 'wordy', 'long', 'bavard', 'talkative'].includes(lower)) return 'verbose'
    if (['normal', 'average', 'standard'].includes(lower)) return 'normal'
    return undefined
}

function normalizeEmotionalState(value: unknown): string | undefined {
    const str = normalizeString(value)
    if (!str) return undefined
    const lower = str.toLowerCase()
    
    const validStates = [
        'stressed', 'happy', 'depressed', 'anxious', 'angry', 
        'excited', 'bored', 'sad', 'lonely', 'confused',
        'hopeful', 'frustrated', 'relaxed', 'worried'
    ]
    
    if (validStates.includes(lower)) return lower
    
    // Mappings
    if (['stress', 'pressured', 'overwhelmed'].includes(lower)) return 'stressed'
    if (['joyful', 'glad', 'content'].includes(lower)) return 'happy'
    if (['down', 'unhappy', 'miserable'].includes(lower)) return 'depressed'
    if (['nervous', 'worried', 'uneasy'].includes(lower)) return 'anxious'
    if (['mad', 'furious', 'irritated'].includes(lower)) return 'angry'
    if (['enthusiastic', 'thrilled'].includes(lower)) return 'excited'
    if (['alone', 'isolated'].includes(lower)) return 'lonely'
    
    return lower
}

function normalizeVulnerabilities(value: unknown): string[] {
    const arr = normalizeArray(value)
    const validVulns = [
        'lonely', 'financial_pressure', 'seeking_validation', 'insecure',
        'guilty', 'fearful', 'attached', 'compliant', 'dependent',
        'naive', 'impulsive', 'desperate', 'trusts_easily',
        'fear_of_abandonment', 'low_self_esteem', 'people_pleaser'
    ]
    
    return arr.filter(v => {
        const normalized = v.toLowerCase().replace(/\s+/g, '_')
        return validVulns.includes(normalized) || validVulns.some(vv => normalized.includes(vv))
    })
}

function normalizeString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined
    const str = String(value).trim()
    if (str === '' || str.toLowerCase() === 'null') return undefined
    return str
}

function normalizeArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
        .map(item => normalizeString(item))
        .filter((item): item is string => item !== null && item !== undefined)
}
