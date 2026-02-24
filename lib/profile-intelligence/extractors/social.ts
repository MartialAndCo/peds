/**
 * Extracteur Social
 * Extrait: relations familiales, amis, réseau
 */

import { venice } from '@/lib/venice'
import { SOCIAL_PROMPT } from '../prompts'
import { robustJsonParse } from '../json-parser'
import { MessageForExtraction, SocialExtraction } from '../types'

export async function extractSocial(
    messages: MessageForExtraction[],
    apiKey?: string,
    model?: string
): Promise<SocialExtraction> {
    
    const startTime = Date.now()
    
    const relevantMessages = messages.filter(m => 
        m.sender === 'contact' || m.sender === 'ai'
    )
    
    if (relevantMessages.length === 0) {
        return { relationships: [] }
    }
    
    const conversation = relevantMessages
        .map(m => `${m.sender === 'contact' ? 'CONTACT:' : 'AI:'} ${m.text}`)
        .join('\n\n')
    
    try {
        const response = await venice.chatCompletion(
            'You are a social network extraction AI. Output only valid JSON.',
            [],
            `${SOCIAL_PROMPT}\n\nCONVERSATION:\n${conversation}\n\nExtract social JSON:`,
            {
                apiKey,
                model: model || 'google-gemma-3-27b-it',
                temperature: 0.2,
                max_tokens: 600
            }
        )
        
        const parsed = parseSocialResponse(response)
        console.log(`[SocialExtractor] Extracted in ${Date.now() - startTime}ms:`, {
            relationshipCount: parsed.relationships.length
        })
        
        return parsed
        
    } catch (error) {
        console.error('[SocialExtractor] Failed:', error)
        return { relationships: [] }
    }
}

function parseSocialResponse(response: string): SocialExtraction {
    try {
        const data = robustJsonParse(response)
        if (!data) throw new Error('Failed to parse JSON')
        
        const relationships = (data.relationships || [])
            .map((r: any) => ({
                relationType: normalizeRelationType(r.relationType),
                name: normalizeString(r.name),
                details: normalizeString(r.details),
                closeness: normalizeCloseness(r.closeness)
            }))
            .filter((r: any) => r.relationType !== 'other' || r.name || r.details)
        
        return { relationships }
        
    } catch (error) {
        console.error('[SocialExtractor] Parse error:', error)
        return { relationships: [] }
    }
}

function normalizeString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined
    const str = String(value).trim()
    if (str === '' || str.toLowerCase() === 'null' || str.toLowerCase() === 'unknown') return undefined
    return str
}

function normalizeRelationType(value: unknown): string {
    const str = normalizeString(value) || 'other'
    const validTypes = [
        'mother', 'father', 'parent',
        'sibling', 'brother', 'sister',
        'child', 'son', 'daughter',
        'partner', 'boyfriend', 'girlfriend', 'husband', 'wife', 'spouse',
        'ex', 'ex_partner', 'ex_boyfriend', 'ex_girlfriend',
        'friend', 'best_friend', 'colleague', 'boss', 'mentor',
        'pet', 'cousin', 'grandparent', 'grandmother', 'grandfather',
        'uncle', 'aunt', 'nephew', 'niece',
        'crush', 'other'
    ]
    
    const normalized = str.toLowerCase().replace(/\s+/g, '_')
    if (validTypes.includes(normalized)) return normalized
    
    // Mappings
    if (['mom', 'mum', 'maman', 'mère'].includes(normalized)) return 'mother'
    if (['dad', 'papa', 'père'].includes(normalized)) return 'father'
    if (['bro', 'frère'].includes(normalized)) return 'brother'
    if (['sis', 'sœur', 'soeur'].includes(normalized)) return 'sister'
    if (['bf'].includes(normalized)) return 'boyfriend'
    if (['gf'].includes(normalized)) return 'girlfriend'
    if (['dog', 'cat', 'animal'].some(a => normalized.includes(a))) return 'pet'
    
    return 'other'
}

function normalizeCloseness(value: unknown): 'close' | 'distant' | 'conflictual' | 'unknown' | undefined {
    const str = normalizeString(value)
    if (!str) return undefined
    const lower = str.toLowerCase()
    if (['close', 'proche', 'intimate', 'strong'].includes(lower)) return 'close'
    if (['distant', 'éloigné', 'weak', 'loose'].includes(lower)) return 'distant'
    if (['conflictual', 'conflictuelle', 'tense', 'difficult', 'bad'].includes(lower)) return 'conflictual'
    if (['unknown', 'inconnu', 'unsure'].includes(lower)) return 'unknown'
    return undefined
}
