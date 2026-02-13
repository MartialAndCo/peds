/**
 * Extracteur d'Intérêts
 * Extrait: hobbies, préférences, passions
 */

import { venice } from '@/lib/venice'
import { INTEREST_PROMPT } from '../prompts'
import { robustJsonParse } from '../json-parser'
import { MessageForExtraction, InterestExtraction } from '../types'

export async function extractInterests(
    messages: MessageForExtraction[],
    apiKey?: string,
    model?: string
): Promise<InterestExtraction> {
    
    const startTime = Date.now()
    
    const relevantMessages = messages.filter(m => 
        m.sender === 'contact' || m.sender === 'ai'
    )
    
    if (relevantMessages.length === 0) {
        return { interests: [] }
    }
    
    const conversation = relevantMessages
        .map(m => `${m.sender === 'contact' ? 'CONTACT:' : 'AI:'} ${m.text}`)
        .join('\n\n')
    
    try {
        const response = await venice.chatCompletion(
            'You are an interests extraction AI. Output only valid JSON.',
            [],
            `${INTEREST_PROMPT}\n\nCONVERSATION:\n${conversation}\n\nExtract interests JSON:`,
            {
                apiKey,
                model: model || 'venice-uncensored',
                temperature: 0.2,
                max_tokens: 600
            }
        )
        
        const parsed = parseInterestResponse(response)
        console.log(`[InterestExtractor] Extracted in ${Date.now() - startTime}ms:`, {
            interestCount: parsed.interests.length,
            categories: [...new Set(parsed.interests.map(i => i.category))]
        })
        
        return parsed
        
    } catch (error) {
        console.error('[InterestExtractor] Failed:', error)
        return { interests: [] }
    }
}

function parseInterestResponse(response: string): InterestExtraction {
    try {
        const data = robustJsonParse(response)
        if (!data) throw new Error('Failed to parse JSON')
        
        const interests = (data.interests || [])
            .map((i: any) => ({
                category: normalizeCategory(i.category),
                name: String(i.name || '').trim(),
                level: normalizeLevel(i.level),
                details: normalizeString(i.details)
            }))
            .filter((i: any) => i.name && i.name.length > 0)
        
        return { interests }
        
    } catch (error) {
        console.error('[InterestExtractor] Parse error:', error)
        return { interests: [] }
    }
}

function normalizeString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined
    const str = String(value).trim()
    if (str === '' || str.toLowerCase() === 'null') return undefined
    return str
}

function normalizeCategory(value: unknown): string {
    const str = normalizeString(value) || 'other'
    const validCategories = [
        'sport', 'music', 'food', 'hobby', 'entertainment', 
        'tech', 'art', 'travel', 'reading', 'gaming', 'fashion', 'other'
    ]
    
    const lower = str.toLowerCase()
    if (validCategories.includes(lower)) return lower
    
    // Mappings
    if (['sports', 'sport', 'fitness', 'gym'].includes(lower)) return 'sport'
    if (['musique', 'song', 'artist', 'band'].includes(lower)) return 'music'
    if (['cuisine', 'cooking', 'restaurant', 'eat'].includes(lower)) return 'food'
    if (['movie', 'film', 'series', 'tv', 'netflix', 'cinema'].includes(lower)) return 'entertainment'
    if (['game', 'gaming', 'video_game', 'console'].includes(lower)) return 'gaming'
    if (['technology', 'computer', 'phone', 'gadget'].includes(lower)) return 'tech'
    if (['photo', 'photography', 'paint', 'drawing'].includes(lower)) return 'art'
    if (['trip', 'vacation', 'tourism'].includes(lower)) return 'travel'
    if (['book', 'literature', 'read'].includes(lower)) return 'reading'
    
    return 'other'
}

function normalizeLevel(value: unknown): 'casual' | 'enthusiast' | 'passionate' | 'professional' | undefined {
    const str = normalizeString(value)
    if (!str) return undefined
    const lower = str.toLowerCase()
    if (['casual', 'occasionnel', 'sometimes', 'de temps en temps'].includes(lower)) return 'casual'
    if (['enthusiast', 'fan', 'amateur', 'régulier'].includes(lower)) return 'enthusiast'
    if (['passionate', 'passionné', 'love', 'adore', 'obsessed'].includes(lower)) return 'passionate'
    if (['professional', 'pro', 'expert', 'métier'].includes(lower)) return 'professional'
    return undefined
}
