/**
 * Orchestrateur d'Extraction de Profil
 * Coordonne les 6 extracteurs spécialisés EN SÉQUENTIEL (pas parallèle)
 * Délai de 200ms entre chaque appel pour éviter le rate limiting
 */

import { prisma } from '@/lib/prisma'
import { settingsService } from '@/lib/settings-cache'
import { extractIdentity } from './extractors/identity'
import { extractSocial } from './extractors/social'
import { extractContext } from './extractors/context'
import { extractInterests } from './extractors/interest'
import { extractPsychology } from './extractors/psychology'
import { extractFinancial } from './extractors/financial'
import { deduplicateAttributes } from './deduplicator'
import { calculateGlobalConfidence } from './confidence-scorer'
import {
    ExtractionContext,
    FullExtractionResult,
    ExtractedAttribute,
    ExtractionLog
} from './types'

// Délai entre les appels API (ms)
const API_DELAY = 200

export class ProfileExtractionOrchestrator {
    
    /**
     * Exécute l'extraction complète pour un contact
     * SÉQUENTIEL avec délai entre chaque appel
     */
    async extractFullProfile(context: ExtractionContext): Promise<FullExtractionResult> {
        const globalStartTime = Date.now()
        console.log(`[ProfileOrchestrator] Starting SEQUENTIAL extraction for contact ${context.contactId}`)
        
        // Récupérer les settings AI
        const settings = await settingsService.getSettings()
        const apiKey = settings.venice_api_key
        const model = settings.venice_model || 'google-gemma-3-27b-it'
        
        // Exécuter les 6 extracteurs EN SÉQUENTIEL avec délai
        const identity = await this.extractWithDelay(
            () => extractIdentity(context.messages, apiKey, model),
            'Identity',
            0
        )
        
        const social = await this.extractWithDelay(
            () => extractSocial(context.messages, apiKey, model),
            'Social',
            API_DELAY
        )
        
        const ctx = await this.extractWithDelay(
            () => extractContext(context.messages, apiKey, model),
            'Context',
            API_DELAY
        )
        
        const interests = await this.extractWithDelay(
            () => extractInterests(context.messages, apiKey, model),
            'Interests',
            API_DELAY
        )
        
        const psychology = await this.extractWithDelay(
            () => extractPsychology(context.messages, apiKey, model),
            'Psychology',
            API_DELAY
        )
        
        const financial = await this.extractWithDelay(
            () => extractFinancial(context.messages, apiKey, model),
            'Financial',
            API_DELAY
        )
        
        // Synthétiser les attributs plats
        const attributes = this.synthesizeAttributes(
            identity, social, ctx, interests, psychology, financial,
            context.messages
        )
        
        // Dédoublonner avec les attributs existants
        const existingKeys = new Set(context.existingProfile?.attributes.map(a => a.key) || [])
        const deduplicatedAttributes = deduplicateAttributes(attributes, existingKeys)
        
        const processingTime = Date.now() - globalStartTime
        
        console.log(`[ProfileOrchestrator] Extraction complete in ${processingTime}ms:`, {
            identityFields: Object.values(identity).filter(v => v && (!Array.isArray(v) || v.length > 0)).length,
            relationships: social.relationships.length,
            events: ctx.events.length,
            interests: interests.interests.length,
            vulnerabilities: psychology.vulnerabilities.length,
            urgentNeeds: financial.urgentNeeds.length,
            attributes: deduplicatedAttributes.length
        })
        
        return {
            identity,
            social,
            context: ctx,
            interests,
            psychology,
            financial,
            attributes: deduplicatedAttributes,
            processingTimeMs: processingTime
        }
    }
    
    /**
     * Exécute une fonction d'extraction avec délai
     */
    private async extractWithDelay<T>(
        extractor: () => Promise<T>,
        name: string,
        delayMs: number
    ): Promise<T> {
        if (delayMs > 0) {
            console.log(`[ProfileOrchestrator] Waiting ${delayMs}ms before ${name}...`)
            await sleep(delayMs)
        }
        
        const startTime = Date.now()
        console.log(`[ProfileOrchestrator] Starting ${name} extraction...`)
        
        try {
            const result = await extractor()
            console.log(`[ProfileOrchestrator] ${name} completed in ${Date.now() - startTime}ms`)
            return result
        } catch (error) {
            console.error(`[ProfileOrchestrator] ${name} failed:`, error)
            // Retourner un résultat vide en cas d'erreur
            return this.getEmptyResult(name) as T
        }
    }
    
    /**
     * Retourne un résultat vide selon le type d'extracteur
     */
    private getEmptyResult(name: string): any {
        switch (name) {
            case 'Identity':
                return {
                    displayName: null, realName: null, aliases: [], age: undefined,
                    ageConfirmed: false, gender: null, birthDate: undefined,
                    city: null, country: null, timezone: null, maritalStatus: null,
                    livingWith: null, occupation: null, workplace: null,
                    incomeLevel: undefined, schedule: null, platforms: [], usernames: {}
                }
            case 'Social':
                return { relationships: [] }
            case 'Context':
                return { events: [] }
            case 'Interests':
                return { interests: [] }
            case 'Psychology':
                return {
                    traits: { openness: undefined, conscientiousness: undefined, extraversion: undefined, agreeableness: undefined, neuroticism: undefined },
                    communication: { style: undefined, responseSpeed: undefined, verbosity: undefined },
                    emotionalState: undefined, stressors: [], redFlags: [], greenFlags: [], vulnerabilities: []
                }
            case 'Financial':
                return {
                    situation: undefined, occupationType: undefined, hasDebts: undefined,
                    debtAmount: undefined, urgentNeeds: [], paymentCapacity: undefined,
                    paymentMethods: { paypal: undefined, cashapp: undefined, venmo: undefined, bankTransfer: undefined }
                }
            default:
                return {}
        }
    }
    
    /**
     * Sauvegarde le résultat d'extraction en base
     */
    async saveExtraction(
        contactId: string,
        result: FullExtractionResult,
        log: ExtractionLog
    ): Promise<void> {
        
        // Récupérer ou créer le profil
        let profile = await prisma.contactProfile.findUnique({
            where: { contactId }
        })
        
        if (!profile) {
            profile = await prisma.contactProfile.create({
                data: {
                    contactId,
                    displayName: result.identity.displayName,
                    realName: result.identity.realName,
                    aliases: result.identity.aliases,
                    ageConfirmed: result.identity.ageConfirmed,
                    gender: result.identity.gender,
                    birthDate: result.identity.birthDate ? new Date(result.identity.birthDate) : null,
                    city: result.identity.city,
                    country: result.identity.country,
                    timezone: result.identity.timezone,
                    maritalStatus: result.identity.maritalStatus,
                    livingWith: result.identity.livingWith,
                    occupation: result.identity.occupation,
                    workplace: result.identity.workplace,
                    incomeLevel: result.identity.incomeLevel,
                    schedule: result.identity.schedule,
                    platforms: result.identity.platforms,
                    usernames: result.identity.usernames,
                    confidence: calculateGlobalConfidence(result)
                }
            })
        } else {
            // Merge des champs (nouvelles infos écrasent les anciennes si présentes)
            profile = await prisma.contactProfile.update({
                where: { contactId },
                data: {
                    displayName: result.identity.displayName ?? profile.displayName,
                    realName: result.identity.realName ?? profile.realName,
                    aliases: [...new Set([...profile.aliases, ...result.identity.aliases])],
                    ageConfirmed: result.identity.ageConfirmed || profile.ageConfirmed,
                    gender: result.identity.gender ?? profile.gender,
                    city: result.identity.city ?? profile.city,
                    country: result.identity.country ?? profile.country,
                    timezone: result.identity.timezone ?? profile.timezone,
                    maritalStatus: result.identity.maritalStatus ?? profile.maritalStatus,
                    livingWith: result.identity.livingWith ?? profile.livingWith,
                    occupation: result.identity.occupation ?? profile.occupation,
                    workplace: result.identity.workplace ?? profile.workplace,
                    incomeLevel: result.identity.incomeLevel ?? profile.incomeLevel,
                    schedule: result.identity.schedule ?? profile.schedule,
                    platforms: [...new Set([...profile.platforms, ...result.identity.platforms])],
                    usernames: { ...profile.usernames as any, ...result.identity.usernames },
                    confidence: calculateGlobalConfidence(result),
                    updatedAt: new Date()
                }
            })
        }
        
        // Sauvegarder les attributs
        for (const attr of result.attributes) {
            await prisma.contactAttribute.create({
                data: {
                    profileId: profile.id,
                    category: attr.category,
                    key: attr.key,
                    value: attr.value,
                    valueType: attr.valueType,
                    source: attr.source,
                    messageId: attr.messageId,
                    confidence: attr.confidence,
                    context: attr.context,
                    expiresAt: attr.expiresAt
                }
            })
        }
        
        // Sauvegarder les relations
        for (const rel of result.social.relationships) {
            await prisma.contactRelationship.create({
                data: {
                    profileId: profile.id,
                    relationType: rel.relationType,
                    name: rel.name,
                    details: rel.details,
                    closeness: rel.closeness,
                    source: 'message',
                    confidence: 70,
                    context: `Relation: ${rel.relationType}`
                }
            })
        }
        
        // Sauvegarder les événements
        for (const evt of result.context.events) {
            await prisma.contactEvent.create({
                data: {
                    profileId: profile.id,
                    eventType: evt.eventType,
                    title: evt.title,
                    date: evt.date ? new Date(evt.date) : null,
                    dateVague: evt.dateVague,
                    importance: evt.importance,
                    source: 'message',
                    confidence: evt.importance === 'critical' ? 90 : 70,
                    context: evt.title
                }
            })
        }
        
        // Sauvegarder les intérêts
        for (const interest of result.interests.interests) {
            await prisma.contactInterest.create({
                data: {
                    profileId: profile.id,
                    category: interest.category,
                    name: interest.name,
                    level: interest.level,
                    details: interest.details,
                    source: 'message',
                    confidence: interest.level === 'passionate' ? 85 : 70
                }
            })
        }
        
        // Sauvegarder/mettre à jour la psychologie
        await prisma.contactPsychology.upsert({
            where: { profileId: profile.id },
            create: {
                profileId: profile.id,
                openness: result.psychology.traits.openness ?? null,
                conscientiousness: result.psychology.traits.conscientiousness ?? null,
                extraversion: result.psychology.traits.extraversion ?? null,
                agreeableness: result.psychology.traits.agreeableness ?? null,
                neuroticism: result.psychology.traits.neuroticism ?? null,
                communicationStyle: result.psychology.communication.style,
                responseSpeed: result.psychology.communication.responseSpeed,
                verbosity: result.psychology.communication.verbosity,
                emotionalState: result.psychology.emotionalState,
                stressors: result.psychology.stressors,
                redFlags: result.psychology.redFlags,
                greenFlags: result.psychology.greenFlags,
                vulnerabilities: result.psychology.vulnerabilities
            },
            update: {
                openness: result.psychology.traits.openness ?? undefined,
                conscientiousness: result.psychology.traits.conscientiousness ?? undefined,
                extraversion: result.psychology.traits.extraversion ?? undefined,
                agreeableness: result.psychology.traits.agreeableness ?? undefined,
                neuroticism: result.psychology.traits.neuroticism ?? undefined,
                communicationStyle: result.psychology.communication.style ?? undefined,
                responseSpeed: result.psychology.communication.responseSpeed ?? undefined,
                verbosity: result.psychology.communication.verbosity ?? undefined,
                emotionalState: result.psychology.emotionalState ?? undefined,
                stressors: result.psychology.stressors.length > 0 ? result.psychology.stressors : undefined,
                redFlags: result.psychology.redFlags.length > 0 ? result.psychology.redFlags : undefined,
                greenFlags: result.psychology.greenFlags.length > 0 ? result.psychology.greenFlags : undefined,
                vulnerabilities: result.psychology.vulnerabilities.length > 0 ? result.psychology.vulnerabilities : undefined,
                updatedAt: new Date()
            }
        })
        
        // Sauvegarder/mettre à jour le financier
        await prisma.contactFinancial.upsert({
            where: { profileId: profile.id },
            create: {
                profileId: profile.id,
                situation: result.financial.situation,
                occupationType: result.financial.occupationType,
                hasDebts: result.financial.hasDebts,
                debtAmount: result.financial.debtAmount,
                urgentNeeds: result.financial.urgentNeeds,
                paymentCapacity: result.financial.paymentCapacity,
                hasPayPal: result.financial.paymentMethods.paypal,
                hasCashApp: result.financial.paymentMethods.cashapp,
                hasVenmo: result.financial.paymentMethods.venmo,
                hasBankTransfer: result.financial.paymentMethods.bankTransfer,
                isFinanciallyVulnerable: result.financial.urgentNeeds.length > 0 || result.financial.hasDebts === true,
                vulnerabilityContext: result.financial.urgentNeeds.join('; ') || null
            },
            update: {
                situation: result.financial.situation ?? undefined,
                occupationType: result.financial.occupationType ?? undefined,
                hasDebts: result.financial.hasDebts ?? undefined,
                debtAmount: result.financial.debtAmount ?? undefined,
                urgentNeeds: result.financial.urgentNeeds.length > 0 ? result.financial.urgentNeeds : undefined,
                paymentCapacity: result.financial.paymentCapacity ?? undefined,
                hasPayPal: result.financial.paymentMethods.paypal ?? undefined,
                hasCashApp: result.financial.paymentMethods.cashapp ?? undefined,
                hasVenmo: result.financial.paymentMethods.venmo ?? undefined,
                hasBankTransfer: result.financial.paymentMethods.bankTransfer ?? undefined,
                isFinanciallyVulnerable: result.financial.urgentNeeds.length > 0 || result.financial.hasDebts === true,
                vulnerabilityContext: result.financial.urgentNeeds.join('; ') || undefined,
                updatedAt: new Date()
            }
        })
        
        // Logger l'extraction
        await prisma.profileExtractionLog.create({
            data: {
                profileId: profile.id,
                triggeredBy: log.triggeredBy,
                messageRange: log.messageRange,
                attributesFound: log.attributesFound,
                relationshipsFound: log.relationshipsFound,
                eventsFound: log.eventsFound,
                newInfoCount: log.newInfoCount,
                updatedInfoCount: log.updatedInfoCount,
                rejectedCount: log.rejectedCount,
                processingTimeMs: log.processingTimeMs,
                aiTokensUsed: log.aiTokensUsed,
                errors: log.errors
            }
        })
        
        console.log(`[ProfileOrchestrator] Saved extraction for profile ${profile.id}`)
    }
    
    /**
     * Synthétise les extractions en attributs plats
     */
    private synthesizeAttributes(
        identity: any,
        social: any,
        ctx: any,
        interests: any,
        psychology: any,
        financial: any,
        messages: any[]
    ): ExtractedAttribute[] {
        const attributes: ExtractedAttribute[] = []
        
        // Helper pour trouver le message source
        const findSourceMessage = (keyword: string): any => {
            return messages.find(m => 
                m.sender === 'contact' && 
                m.text.toLowerCase().includes(keyword.toLowerCase())
            )
        }
        
        // Attributs d'identité
        if (identity.age) {
            const msg = findSourceMessage(String(identity.age)) || messages[0]
            attributes.push({
                category: 'identity',
                key: 'age',
                value: String(identity.age),
                valueType: 'number',
                source: identity.ageConfirmed ? 'message' : 'deduction',
                confidence: identity.ageConfirmed ? 95 : 70,
                context: msg?.text?.substring(0, 200) || `Age: ${identity.age}`,
                messageId: msg?.id
            })
        }
        
        if (identity.city) {
            const msg = findSourceMessage(identity.city) || messages[0]
            attributes.push({
                category: 'location',
                key: 'city',
                value: identity.city,
                valueType: 'string',
                source: 'message',
                confidence: 85,
                context: msg?.text?.substring(0, 200) || `City: ${identity.city}`,
                messageId: msg?.id
            })
        }
        
        if (identity.occupation) {
            const msg = findSourceMessage(identity.occupation) || messages[0]
            attributes.push({
                category: 'work',
                key: 'occupation',
                value: identity.occupation,
                valueType: 'string',
                source: 'message',
                confidence: 80,
                context: msg?.text?.substring(0, 200) || `Occupation: ${identity.occupation}`,
                messageId: msg?.id
            })
        }
        
        if (identity.workplace) {
            attributes.push({
                category: 'work',
                key: 'workplace',
                value: identity.workplace,
                valueType: 'string',
                source: 'message',
                confidence: 85,
                context: `Workplace: ${identity.workplace}`,
                messageId: findSourceMessage(identity.workplace)?.id
            })
        }
        
        // Attributs financiers critiques
        if (financial.hasDebts === true && financial.debtAmount) {
            attributes.push({
                category: 'finance',
                key: 'has_debts',
                value: 'true',
                valueType: 'boolean',
                source: 'message',
                confidence: 90,
                context: `Debt: ${financial.debtAmount}`,
                messageId: findSourceMessage(financial.debtAmount)?.id
            })
            
            attributes.push({
                category: 'finance',
                key: 'debt_amount',
                value: financial.debtAmount,
                valueType: 'string',
                source: 'message',
                confidence: 90,
                context: `Debt details: ${financial.debtAmount}`,
                messageId: findSourceMessage(financial.debtAmount)?.id
            })
        }
        
        // Urgent needs avec expiration
        for (const need of financial.urgentNeeds) {
            attributes.push({
                category: 'finance',
                key: 'urgent_need',
                value: need,
                valueType: 'string',
                source: 'message',
                confidence: 85,
                context: need,
                messageId: findSourceMessage(need)?.id,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            })
        }
        
        // Vulnérabilités psychologiques
        for (const vuln of psychology.vulnerabilities) {
            attributes.push({
                category: 'psych',
                key: `vuln_${vuln}`,
                value: 'true',
                valueType: 'boolean',
                source: 'inference',
                confidence: 65,
                context: `Detected vulnerability: ${vuln}`,
                messageId: messages[0]?.id
            })
        }
        
        // État émotionnel (expire après 7 jours)
        if (psychology.emotionalState) {
            attributes.push({
                category: 'psych',
                key: 'emotional_state',
                value: psychology.emotionalState,
                valueType: 'string',
                source: 'inference',
                confidence: 70,
                context: `Emotional state: ${psychology.emotionalState}`,
                messageId: messages[0]?.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            })
        }
        
        return attributes
    }
}

// Helper pour le délai
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// Singleton
export const profileOrchestrator = new ProfileExtractionOrchestrator()
