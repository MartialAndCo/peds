/**
 * Calculateur de Score de Confiance
 * Évalue la qualité globale d'une extraction de profil
 */

import { FullExtractionResult } from './types'

interface ConfidenceBreakdown {
    identityScore: number
    socialScore: number
    contextScore: number
    interestScore: number
    psychologyScore: number
    financialScore: number
    overall: number
}

/**
 * Calcule le score de confiance global d'une extraction
 */
export function calculateGlobalConfidence(result: FullExtractionResult): number {
    const breakdown = calculateConfidenceBreakdown(result)
    return breakdown.overall
}

/**
 * Calcule le détail du score de confiance par catégorie
 */
export function calculateConfidenceBreakdown(result: FullExtractionResult): ConfidenceBreakdown {
    
    // Score Identité (0-100)
    const identityScore = calculateIdentityScore(result)
    
    // Score Social (0-100)
    const socialScore = calculateSocialScore(result)
    
    // Score Contexte (0-100)
    const contextScore = calculateContextScore(result)
    
    // Score Intérêts (0-100)
    const interestScore = calculateInterestScore(result)
    
    // Score Psychologie (0-100)
    const psychologyScore = calculatePsychologyScore(result)
    
    // Score Financier (0-100)
    const financialScore = calculateFinancialScore(result)
    
    // Score global pondéré
    const weights = {
        identity: 0.25,
        social: 0.10,
        context: 0.15,
        interests: 0.10,
        psychology: 0.20,
        financial: 0.20
    }
    
    const overall = Math.round(
        identityScore * weights.identity +
        socialScore * weights.social +
        contextScore * weights.context +
        interestScore * weights.interests +
        psychologyScore * weights.psychology +
        financialScore * weights.financial
    )
    
    return {
        identityScore,
        socialScore,
        contextScore,
        interestScore,
        psychologyScore,
        financialScore,
        overall
    }
}

function calculateIdentityScore(result: FullExtractionResult): number {
    const { identity } = result
    let score = 0
    let maxScore = 0
    
    // Nom (20 points)
    maxScore += 20
    if (identity.realName) score += 20
    else if (identity.displayName) score += 10
    
    // Âge (15 points)
    maxScore += 15
    if (identity.age) {
        score += identity.ageConfirmed ? 15 : 10
    }
    
    // Genre (10 points)
    maxScore += 10
    if (identity.gender) score += 10
    
    // Localisation (20 points)
    maxScore += 20
    if (identity.city && identity.country) score += 20
    else if (identity.city || identity.country) score += 12
    
    // Profession (20 points)
    maxScore += 20
    if (identity.occupation && identity.workplace) score += 20
    else if (identity.occupation) score += 15
    
    // Online presence (15 points)
    maxScore += 15
    if (identity.platforms.length >= 2) score += 15
    else if (identity.platforms.length === 1) score += 8
    
    return Math.round((score / maxScore) * 100)
}

function calculateSocialScore(result: FullExtractionResult): number {
    const { social } = result
    
    if (social.relationships.length === 0) return 0
    if (social.relationships.length >= 3) return 100
    if (social.relationships.length === 2) return 70
    return 40
}

function calculateContextScore(result: FullExtractionResult): number {
    const { context } = result
    
    let score = 0
    
    // Nombre d'événements
    score += Math.min(context.events.length * 15, 50)
    
    // Événements critiques/majeurs
    const criticalEvents = context.events.filter(e => 
        e.importance === 'critical' || e.importance === 'major'
    ).length
    score += criticalEvents * 15
    
    // Événements à venir (plus utiles pour l'action)
    const upcomingEvents = context.events.filter(e => 
        e.eventType === 'upcoming'
    ).length
    score += upcomingEvents * 10
    
    return Math.min(score, 100)
}

function calculateInterestScore(result: FullExtractionResult): number {
    const { interests } = result
    
    if (interests.interests.length === 0) return 0
    if (interests.interests.length >= 5) return 100
    if (interests.interests.length >= 3) return 70
    return 40 + (interests.interests.length * 10)
}

function calculatePsychologyScore(result: FullExtractionResult): number {
    const { psychology } = result
    let score = 0
    let maxScore = 0
    
    // Traits Big Five (50 points)
    const traits = [
        psychology.traits.openness,
        psychology.traits.conscientiousness,
        psychology.traits.extraversion,
        psychology.traits.agreeableness,
        psychology.traits.neuroticism
    ].filter(t => t !== undefined)
    
    maxScore += 50
    score += (traits.length / 5) * 50
    
    // État émotionnel (20 points)
    maxScore += 20
    if (psychology.emotionalState) score += 20
    
    // Vulnérabilités (30 points) - CRITIQUE pour escalation
    maxScore += 30
    if (psychology.vulnerabilities.length >= 2) score += 30
    else if (psychology.vulnerabilities.length === 1) score += 20
    
    return Math.round((score / maxScore) * 100)
}

function calculateFinancialScore(result: FullExtractionResult): number {
    const { financial } = result
    let score = 0
    let maxScore = 0
    
    // Situation générale (20 points)
    maxScore += 20
    if (financial.situation) score += 20
    
    // Dettes (30 points) - important pour stories
    maxScore += 30
    if (financial.hasDebts !== undefined) score += 15
    if (financial.debtAmount) score += 15
    
    // Besoins urgents (30 points) - opportunités immédiates
    maxScore += 30
    if (financial.urgentNeeds.length > 0) {
        score += Math.min(financial.urgentNeeds.length * 15, 30)
    }
    
    // Capacité de paiement (20 points)
    maxScore += 20
    if (financial.paymentCapacity) score += 20
    
    return Math.round((score / maxScore) * 100)
}

/**
 * Retourne une interprétation textuelle du score
 */
export function getConfidenceLabel(score: number): {
    label: string
    color: string
    description: string
} {
    if (score >= 80) {
        return {
            label: 'Élevée',
            color: '#10b981', // emerald-500
            description: 'Profil fiable et bien documenté'
        }
    }
    if (score >= 60) {
        return {
            label: 'Bonne',
            color: '#3b82f6', // blue-500
            description: 'Profil solide avec quelques lacunes'
        }
    }
    if (score >= 40) {
        return {
            label: 'Moyenne',
            color: '#f59e0b', // amber-500
            description: 'Profil partiel, besoin de plus d\'informations'
        }
    }
    if (score >= 20) {
        return {
            label: 'Faible',
            color: '#f97316', // orange-500
            description: 'Peu d\'informations disponibles'
        }
    }
    return {
        label: 'Insuffisante',
        color: '#ef4444', // red-500
        description: 'Profil quasi vide - extraire d\'urgence'
    }
}

/**
 * Calcule le score de confiance d'un attribut individuel
 * Basé sur la source et la clarté
 */
export function calculateAttributeConfidence(
    source: 'message' | 'deduction' | 'inference',
    context: string,
    hasExplicitStatement: boolean
): number {
    let baseScore = 50
    
    // Source
    if (source === 'message') baseScore = 90
    else if (source === 'deduction') baseScore = 70
    else if (source === 'inference') baseScore = 50
    
    // Clarté du contexte
    if (context.length > 100) baseScore += 5
    if (hasExplicitStatement) baseScore += 5
    
    // Plafonner
    return Math.min(baseScore, 100)
}
