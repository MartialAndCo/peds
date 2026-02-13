/**
 * Parseur JSON robuste pour les réponses de l'IA
 * Gère les cas où le JSON est malformé ou incomplet
 */

/**
 * Extrait et parse le JSON d'une réponse texte
 * Gère: markdown code blocks, JSON tronqué, virgules en trop, etc.
 */
export function robustJsonParse(text: string): any | null {
    if (!text || typeof text !== 'string') {
        return null
    }

    // Nettoyer le texte
    let cleaned = text.trim()

    // Extraire du bloc markdown si présent
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim()
    }

    // Essayer de parser directement
    try {
        return JSON.parse(cleaned)
    } catch {
        // Continuer avec les corrections
    }

    // Corriger les problèmes courants
    let fixed = cleaned

    // 1. Ajouter des guillemets manquants autour des clés
    fixed = fixed.replace(/(\{|,\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')

    // 2. Supprimer les virgules en trop avant } ou ]
    fixed = fixed.replace(/,\s*([}\]])/g, '$1')

    // 3. Corriger les valeurs undefined (remplacer par null)
    fixed = fixed.replace(/:\s*undefined\s*([,}\]])/g, ':null$1')

    // 4. Corriger les guillemets simples par des guillemets doubles
    fixed = fixed.replace(/'/g, '"')

    // 5. Corriger les booléens/minuscules
    fixed = fixed.replace(/:\s*True\s*([,}\]])/gi, ':true$1')
    fixed = fixed.replace(/:\s*False\s*([,}\]])/gi, ':false$1')
    fixed = fixed.replace(/:\s*None\s*([,}\]])/gi, ':null$1')

    // 6. Si le JSON semble tronqué, essayer de le compléter
    const openBraces = (fixed.match(/\{/g) || []).length
    const closeBraces = (fixed.match(/\}/g) || []).length
    const openBrackets = (fixed.match(/\[/g) || []).length
    const closeBrackets = (fixed.match(/\]/g) || []).length

    if (openBraces > closeBraces) {
        fixed += '}'.repeat(openBraces - closeBraces)
    }
    if (openBrackets > closeBrackets) {
        fixed += ']'.repeat(openBrackets - closeBrackets)
    }

    // Essayer de parser à nouveau
    try {
        return JSON.parse(fixed)
    } catch {
        // Dernier recours: extraire l'objet le plus complet possible
        return extractBestEffort(cleaned)
    }
}

/**
 * Extraction au mieux quand le JSON est vraiment cassé
 */
function extractBestEffort(text: string): any | null {
    // Chercher le premier { et le dernier }
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        return null
    }

    let candidate = text.substring(firstBrace, lastBrace + 1)

    // Essayer de parser ce segment
    try {
        return JSON.parse(candidate)
    } catch {
        // Trop cassé, retourner null
        return null
    }
}

/**
 * Extrait un tableau JSON d'une réponse
 */
export function robustJsonArrayParse(text: string): any[] | null {
    const result = robustJsonParse(text)
    
    if (Array.isArray(result)) {
        return result
    }
    
    // Si c'est un objet avec une propriété qui contient un tableau
    if (result && typeof result === 'object') {
        for (const key of Object.keys(result)) {
            if (Array.isArray(result[key])) {
                return result[key]
            }
        }
    }
    
    return null
}

/**
 * Valide qu'un objet a la structure attendue
 */
export function validateStructure(obj: any, requiredFields: string[]): boolean {
    if (!obj || typeof obj !== 'object') {
        return false
    }
    
    return requiredFields.every(field => field in obj)
}
