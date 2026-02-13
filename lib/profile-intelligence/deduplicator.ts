/**
 * Dédoublonnage Sémantique
 * Évite de créer des attributs redondants avec ceux existants
 */

import { ExtractedAttribute } from './types'

interface ExistingAttribute {
    key: string
    value: string
    category: string
    confidence: number
}

/**
 * Dédoublonne les nouveaux attributs par rapport aux existants
 * Garde celui avec la meilleure confiance en cas de conflit
 */
export function deduplicateAttributes(
    newAttributes: ExtractedAttribute[],
    existingKeys: Set<string>
): ExtractedAttribute[] {
    
    const result: ExtractedAttribute[] = []
    const seenKeys = new Set<string>()
    
    for (const attr of newAttributes) {
        // Normaliser la clé pour comparaison
        const normalizedKey = normalizeKey(attr.key)
        
        // Si déjà vu dans ce batch, garder le meilleur
        if (seenKeys.has(normalizedKey)) {
            const existing = result.find(r => normalizeKey(r.key) === normalizedKey)
            if (existing && attr.confidence > existing.confidence) {
                existing.value = attr.value
                existing.confidence = attr.confidence
                existing.context = attr.context
            }
            continue
        }
        
        // Si existe déjà en base avec meilleure confiance, skip
        if (existingKeys.has(normalizedKey)) {
            console.log(`[Deduplicator] Skipping ${attr.key} - already exists in DB`)
            continue
        }
        
        // Vérifier la similarité sémantique avec les clés existantes
        const similarKey = findSimilarKey(normalizedKey, existingKeys)
        if (similarKey && !isSignificantDifference(attr.key, similarKey)) {
            console.log(`[Deduplicator] Skipping ${attr.key} - similar to ${similarKey}`)
            continue
        }
        
        seenKeys.add(normalizedKey)
        result.push(attr)
    }
    
    console.log(`[Deduplicator] ${newAttributes.length} → ${result.length} attributes after dedup`)
    return result
}

/**
 * Normalise une clé pour comparaison
 */
function normalizeKey(key: string): string {
    return key
        .toLowerCase()
        .replace(/[_-]/g, '')
        .replace(/\s+/g, '')
        .trim()
}

/**
 * Trouve une clé similaire dans l'ensemble existant
 */
function findSimilarKey(key: string, existingKeys: Set<string>): string | null {
    for (const existing of existingKeys) {
        if (isSimilar(key, existing)) {
            return existing
        }
    }
    return null
}

/**
 * Calcule la similarité entre deux clés
 */
function isSimilar(a: string, b: string): boolean {
    const na = normalizeKey(a)
    const nb = normalizeKey(b)
    
    // Identique
    if (na === nb) return true
    
    // Une contient l'autre
    if (na.includes(nb) || nb.includes(na)) return true
    
    // Distance de Levenshtein courte (fautes de frappe)
    if (levenshtein(na, nb) <= 2) return true
    
    // Synonymes communs
    const synonyms: Record<string, string[]> = {
        'age': ['yearsold', 'years', 'old'],
        'city': ['town', 'location', 'place', 'live'],
        'job': ['work', 'occupation', 'profession', 'career'],
        'name': ['firstname', 'lastname', 'fullname'],
        'debt': ['loan', 'owe', 'due', 'bill'],
        'pet': ['dog', 'cat', 'animal']
    }
    
    for (const [base, alts] of Object.entries(synonyms)) {
        const hasBase = na === base || nb === base
        const hasAlt = alts.some(alt => na.includes(alt) || nb.includes(alt))
        if (hasBase && hasAlt) return true
    }
    
    return false
}

/**
 * Détermine si la différence entre deux clés est significative
 * (pour garder les deux malgré la similarité)
 */
function isSignificantDifference(newKey: string, existingKey: string): boolean {
    // age vs birth_date - différent
    if (newKey.includes('age') && existingKey.includes('birth')) return true
    if (newKey.includes('birth') && existingKey.includes('age')) return true
    
    // city vs country - différent
    if (newKey.includes('city') && existingKey.includes('country')) return true
    if (newKey.includes('country') && existingKey.includes('city')) return true
    
    // first_name vs last_name - différent
    if (newKey.includes('first') && existingKey.includes('last')) return true
    if (newKey.includes('last') && existingKey.includes('first')) return true
    
    return false
}

/**
 * Distance de Levenshtein (édition distance)
 */
function levenshtein(a: string, b: string): number {
    const matrix: number[][] = []
    
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i]
    }
    
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j
    }
    
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                )
            }
        }
    }
    
    return matrix[b.length][a.length]
}

/**
 * Détecte les contradictions entre attributs
 * Retourne les paires contradictoires trouvées
 */
export function detectContradictions(
    attributes: ExtractedAttribute[]
): Array<{ attr1: ExtractedAttribute; attr2: ExtractedAttribute; reason: string }> {
    
    const contradictions: Array<{ attr1: ExtractedAttribute; attr2: ExtractedAttribute; reason: string }> = []
    
    // Grouper par clé
    const byKey = new Map<string, ExtractedAttribute[]>()
    for (const attr of attributes) {
        const key = normalizeKey(attr.key)
        if (!byKey.has(key)) byKey.set(key, [])
        byKey.get(key)!.push(attr)
    }
    
    // Vérifier les contradictions pour chaque groupe
    for (const [key, attrs] of byKey) {
        if (attrs.length < 2) continue
        
        // Vérifier les valeurs numériques (âge, etc.)
        const numericValues = attrs
            .map(a => ({ attr: a, num: Number(a.value) }))
            .filter(x => !isNaN(x.num))
        
        if (numericValues.length >= 2) {
            const values = numericValues.map(x => x.num)
            const max = Math.max(...values)
            const min = Math.min(...values)
            
            // Si écart > 20% pour des nombres proches, c'est une contradiction
            if ((max - min) / max > 0.2 && max < 1000) {
                contradictions.push({
                    attr1: numericValues[0].attr,
                    attr2: numericValues[1].attr,
                    reason: `Valeurs contradictoires: ${min} vs ${max}`
                })
            }
        }
        
        // Vérifier les booléens opposés
        const boolValues = attrs.filter(a => 
            a.value.toLowerCase() === 'true' || 
            a.value.toLowerCase() === 'false'
        )
        
        if (boolValues.length >= 2) {
            const trues = boolValues.filter(a => a.value.toLowerCase() === 'true')
            const falses = boolValues.filter(a => a.value.toLowerCase() === 'false')
            
            if (trues.length > 0 && falses.length > 0) {
                contradictions.push({
                    attr1: trues[0],
                    attr2: falses[0],
                    reason: 'Valeurs booléennes opposées'
                })
            }
        }
    }
    
    return contradictions
}
