/**
 * Extracteur Financier
 * Extrait: situation financière, dettes, capacité de paiement
 * CRITIQUE pour les stories de paiement
 */

import { venice } from '@/lib/venice'
import { FINANCIAL_PROMPT } from '../prompts'
import { robustJsonParse } from '../json-parser'
import { MessageForExtraction, FinancialExtraction } from '../types'

export async function extractFinancial(
    messages: MessageForExtraction[],
    apiKey?: string,
    model?: string
): Promise<FinancialExtraction> {
    
    const startTime = Date.now()
    
    const relevantMessages = messages.filter(m => 
        m.sender === 'contact' || m.sender === 'ai'
    )
    
    if (relevantMessages.length === 0) {
        return getEmptyFinancial()
    }
    
    const conversation = relevantMessages
        .map(m => `${m.sender === 'contact' ? 'CONTACT:' : 'AI:'} ${m.text}`)
        .join('\n\n')
    
    try {
        const response = await venice.chatCompletion(
            'You are a financial situation extraction AI. Output only valid JSON.',
            [],
            `${FINANCIAL_PROMPT}\n\nCONVERSATION:\n${conversation}\n\nExtract financial JSON:`,
            {
                apiKey,
                model: model || 'google-gemma-3-27b-it',
                temperature: 0.2,
                max_tokens: 600
            }
        )
        
        const parsed = parseFinancialResponse(response)
        console.log(`[FinancialExtractor] Extracted in ${Date.now() - startTime}ms:`, {
            situation: parsed.situation,
            hasDebts: parsed.hasDebts,
            urgentNeedsCount: parsed.urgentNeeds.length,
            paymentCapacity: parsed.paymentCapacity
        })
        
        return parsed
        
    } catch (error) {
        console.error('[FinancialExtractor] Failed:', error)
        return getEmptyFinancial()
    }
}

function parseFinancialResponse(response: string): FinancialExtraction {
    try {
        const data = robustJsonParse(response)
        if (!data) throw new Error('Failed to parse JSON')
        
        return {
            situation: normalizeSituation(data.situation),
            occupationType: normalizeOccupationType(data.occupationType),
            hasDebts: normalizeBoolean(data.hasDebts),
            debtAmount: normalizeString(data.debtAmount),
            urgentNeeds: normalizeArray(data.urgentNeeds),
            paymentCapacity: normalizeCapacity(data.paymentCapacity),
            paymentMethods: {
                paypal: normalizeBoolean(data.paymentMethods?.paypal),
                cashapp: normalizeBoolean(data.paymentMethods?.cashapp),
                venmo: normalizeBoolean(data.paymentMethods?.venmo),
                bankTransfer: normalizeBoolean(data.paymentMethods?.bankTransfer)
            }
        }
        
    } catch (error) {
        console.error('[FinancialExtractor] Parse error:', error)
        return getEmptyFinancial()
    }
}

function getEmptyFinancial(): FinancialExtraction {
    return {
        situation: undefined,
        occupationType: undefined,
        hasDebts: undefined,
        debtAmount: undefined,
        urgentNeeds: [],
        paymentCapacity: undefined,
        paymentMethods: {
            paypal: undefined,
            cashapp: undefined,
            venmo: undefined,
            bankTransfer: undefined
        }
    }
}

function normalizeString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined
    const str = String(value).trim()
    if (str === '' || str.toLowerCase() === 'null') return undefined
    return str
}

function normalizeBoolean(value: unknown): boolean | undefined {
    if (value === true) return true
    if (value === false) return false
    if (typeof value === 'string') {
        const lower = value.toLowerCase()
        if (['true', 'yes', 'oui', '1'].includes(lower)) return true
        if (['false', 'no', 'non', '0'].includes(lower)) return false
    }
    return undefined
}

function normalizeArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
        .map(item => normalizeString(item))
        .filter((item): item is string => item !== undefined)
}

function normalizeSituation(value: unknown): 'stable' | 'precarious' | 'wealthy' | 'struggling' | 'unknown' | undefined {
    const str = normalizeString(value)
    if (!str) return undefined
    const lower = str.toLowerCase()
    
    if (['stable', 'stable', 'comfortable', 'ok', 'bien'].includes(lower)) return 'stable'
    if (['precarious', 'précaire', 'unstable', 'instable'].includes(lower)) return 'precarious'
    if (['wealthy', 'rich', 'aisé', 'riche', 'well_off'].includes(lower)) return 'wealthy'
    if (['struggling', 'galère', 'difficult', 'hard', 'tough', 'dur'].includes(lower)) return 'struggling'
    if (['unknown', 'inconnu', 'not_sure'].includes(lower)) return 'unknown'
    
    return undefined
}

function normalizeOccupationType(value: unknown): 'employed' | 'student' | 'unemployed' | 'retired' | 'self_employed' | undefined {
    const str = normalizeString(value)
    if (!str) return undefined
    const lower = str.toLowerCase().replace(/[-_]/g, '_')
    
    const valid = ['employed', 'student', 'unemployed', 'retired', 'self_employed']
    if (valid.includes(lower)) return lower as any
    
    // Mappings
    if (['salarié', 'cdi', 'cdd', 'worker', 'employee', 'job'].includes(lower)) return 'employed'
    if (['étudiant', 'etudiant', 'lycéen', 'universitaire', 'school', 'college'].includes(lower)) return 'student'
    if (['chômage', 'chomage', 'sans_emploi', 'no_job', 'jobless'].includes(lower)) return 'unemployed'
    if (['retraité', 'retraite', 'pensionné', 'pensioner'].includes(lower)) return 'retired'
    if (['indépendant', 'independant', 'freelance', 'entrepreneur', 'auto_entrepreneur'].includes(lower)) return 'self_employed'
    
    return undefined
}

function normalizeCapacity(value: unknown): 'none' | 'low' | 'medium' | 'high' | undefined {
    const str = normalizeString(value)
    if (!str) return undefined
    const lower = str.toLowerCase()
    
    if (['none', 'zero', 'aucun', 'nothing', 'rien', 'no_capacity'].includes(lower)) return 'none'
    if (['low', 'faible', 'limited', 'little', 'peu'].includes(lower)) return 'low'
    if (['medium', 'moyen', 'average', 'moderate'].includes(lower)) return 'medium'
    if (['high', 'élevé', 'elevated', 'good', 'strong'].includes(lower)) return 'high'
    
    return undefined
}
