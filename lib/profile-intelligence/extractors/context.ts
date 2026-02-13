/**
 * Extracteur de Contexte
 * Extrait: événements de vie, projets, contraintes
 */

import { venice } from '@/lib/venice'
import { CONTEXT_PROMPT } from '../prompts'
import { robustJsonParse } from '../json-parser'
import { MessageForExtraction, ContextExtraction } from '../types'

export async function extractContext(
    messages: MessageForExtraction[],
    apiKey?: string,
    model?: string
): Promise<ContextExtraction> {
    
    const startTime = Date.now()
    
    const relevantMessages = messages.filter(m => 
        m.sender === 'contact' || m.sender === 'ai'
    )
    
    if (relevantMessages.length === 0) {
        return { events: [] }
    }
    
    const conversation = relevantMessages
        .map(m => `${m.sender === 'contact' ? 'CONTACT:' : 'AI:'} ${m.text}`)
        .join('\n\n')
    
    try {
        const response = await venice.chatCompletion(
            'You are a life context extraction AI. Output only valid JSON.',
            [],
            `${CONTEXT_PROMPT}\n\nCONVERSATION:\n${conversation}\n\nExtract context JSON:`,
            {
                apiKey,
                model: model || 'venice-uncensored',
                temperature: 0.2,
                max_tokens: 700
            }
        )
        
        const parsed = parseContextResponse(response)
        console.log(`[ContextExtractor] Extracted in ${Date.now() - startTime}ms:`, {
            eventCount: parsed.events.length,
            criticalEvents: parsed.events.filter(e => e.importance === 'critical').length
        })
        
        return parsed
        
    } catch (error) {
        console.error('[ContextExtractor] Failed:', error)
        return { events: [] }
    }
}

function parseContextResponse(response: string): ContextExtraction {
    try {
        const data = robustJsonParse(response)
        if (!data) throw new Error('Failed to parse JSON')
        
        const events = (data.events || [])
            .map((e: any) => ({
                eventType: normalizeEventType(e.eventType),
                title: String(e.title || '').trim(),
                date: normalizeDate(e.date),
                dateVague: normalizeString(e.dateVague),
                importance: normalizeImportance(e.importance)
            }))
            .filter((e: any) => e.title && e.title.length > 0)
        
        return { events }
        
    } catch (error) {
        console.error('[ContextExtractor] Parse error:', error)
        return { events: [] }
    }
}

function normalizeString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined
    const str = String(value).trim()
    if (str === '' || str.toLowerCase() === 'null') return undefined
    return str
}

function normalizeEventType(value: unknown): 'past' | 'upcoming' | 'recurring' {
    const str = normalizeString(value) || 'past'
    const lower = str.toLowerCase()
    if (['upcoming', 'future', 'coming', 'à venir', 'prochain'].includes(lower)) return 'upcoming'
    if (['recurring', 'regular', 'récurrent', 'régulier', 'habituel'].includes(lower)) return 'recurring'
    return 'past'
}

function normalizeImportance(value: unknown): 'minor' | 'normal' | 'major' | 'critical' {
    const str = normalizeString(value) || 'normal'
    const lower = str.toLowerCase()
    if (['critical', 'critique', 'crucial', 'vital', 'urgent', 'life_changing'].includes(lower)) return 'critical'
    if (['major', 'majeur', 'important', 'significant', 'big'].includes(lower)) return 'major'
    if (['minor', 'mineur', 'small', 'petit', 'insignificant'].includes(lower)) return 'minor'
    return 'normal'
}

function normalizeDate(value: unknown): string | undefined {
    const str = normalizeString(value)
    if (!str) return undefined
    
    // Vérifier format ISO
    const isoRegex = /^\d{4}-\d{2}-\d{2}/
    if (isoRegex.test(str)) return str
    
    // Essayer de parser
    try {
        const date = new Date(str)
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0]
        }
    } catch {}
    
    return undefined
}
