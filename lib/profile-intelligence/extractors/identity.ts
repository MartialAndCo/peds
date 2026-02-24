/**
 * Extracteur d'Identité
 * Extrait: noms, âge, localisation, situation, profession, présence online
 */

import { venice } from '@/lib/venice'
import { IDENTITY_PROMPT } from '../prompts'
import { robustJsonParse } from '../json-parser'
import { MessageForExtraction, IdentityExtraction } from '../types'

export async function extractIdentity(
    messages: MessageForExtraction[],
    apiKey?: string,
    model?: string
): Promise<IdentityExtraction> {
    
    const startTime = Date.now()
    
    // Filtrer uniquement les messages du contact + AI pour contexte
    const relevantMessages = messages.filter(m => 
        m.sender === 'contact' || m.sender === 'ai'
    )
    
    if (relevantMessages.length === 0) {
        return getEmptyIdentity()
    }
    
    // Formater la conversation
    const conversation = relevantMessages
        .map(m => {
            const prefix = m.sender === 'contact' ? 'CONTACT:' : 'AI:'
            return `${prefix} ${m.text}`
        })
        .join('\n\n')
    
    try {
        const response = await venice.chatCompletion(
            'You are an identity extraction AI. Output only valid JSON.',
            [],
            `${IDENTITY_PROMPT}\n\nCONVERSATION:\n${conversation}\n\nExtract identity JSON:`,
            {
                apiKey,
                model: model || 'google-gemma-3-27b-it',
                temperature: 0.2, // Bas pour cohérence
                max_tokens: 800
            }
        )
        
        const parsed = parseIdentityResponse(response)
        console.log(`[IdentityExtractor] Extracted in ${Date.now() - startTime}ms:`, {
            hasName: !!parsed.displayName || !!parsed.realName,
            hasAge: !!parsed.age,
            hasLocation: !!parsed.city || !!parsed.country,
            platformCount: parsed.platforms.length
        })
        
        return parsed
        
    } catch (error) {
        console.error('[IdentityExtractor] Failed:', error)
        return getEmptyIdentity()
    }
}

function parseIdentityResponse(response: string): IdentityExtraction {
    try {
        const data = robustJsonParse(response)
        if (!data) {
            throw new Error('Failed to parse JSON')
        }
        
        // Normaliser et valider
        return {
            displayName: normalizeString(data.displayName),
            realName: normalizeString(data.realName),
            aliases: normalizeArray(data.aliases),
            age: normalizeNumber(data.age),
            ageConfirmed: !!data.ageConfirmed,
            gender: normalizeString(data.gender),
            birthDate: normalizeString(data.birthDate),
            city: normalizeString(data.city),
            country: normalizeString(data.country),
            timezone: normalizeString(data.timezone),
            maritalStatus: normalizeString(data.maritalStatus),
            livingWith: normalizeString(data.livingWith),
            occupation: normalizeString(data.occupation),
            workplace: normalizeString(data.workplace),
            incomeLevel: normalizeIncomeLevel(data.incomeLevel),
            schedule: normalizeString(data.schedule),
            platforms: normalizeArray(data.platforms),
            usernames: normalizeObject(data.usernames)
        }
        
    } catch (error) {
        console.error('[IdentityExtractor] Parse error:', error)
        return getEmptyIdentity()
    }
}

function getEmptyIdentity(): IdentityExtraction {
    return {
        displayName: undefined,
        realName: undefined,
        aliases: [],
        age: undefined,
        ageConfirmed: false,
        gender: undefined,
        birthDate: undefined,
        city: undefined,
        country: undefined,
        timezone: undefined,
        maritalStatus: undefined,
        livingWith: undefined,
        occupation: undefined,
        workplace: undefined,
        incomeLevel: undefined,
        schedule: undefined,
        platforms: [],
        usernames: {}
    }
}

// Fonctions de normalisation
function normalizeString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined
    const str = String(value).trim()
    if (str === '' || str.toLowerCase() === 'null') return undefined
    return str
}

function normalizeNumber(value: unknown): number | undefined {
    if (value === null || value === undefined) return undefined
    const num = Number(value)
    if (isNaN(num)) return undefined
    return num
}

function normalizeArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
        .map(item => normalizeString(item))
        .filter((item): item is string => item !== null)
}

function normalizeObject(value: unknown): Record<string, string> {
    if (typeof value !== 'object' || value === null) return {}
    const result: Record<string, string> = {}
    for (const [key, val] of Object.entries(value)) {
        const normalized = normalizeString(val)
        if (normalized) result[key] = normalized
    }
    return result
}

function normalizeIncomeLevel(value: unknown): 'low' | 'medium' | 'high' | undefined {
    const str = normalizeString(value)
    if (!str) return undefined
    const lower = str.toLowerCase()
    if (['low', 'faible', 'bas'].includes(lower)) return 'low'
    if (['medium', 'moyen', 'average'].includes(lower)) return 'medium'
    if (['high', 'élevé', 'haut', 'wealthy'].includes(lower)) return 'high'
    return undefined
}
