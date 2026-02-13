/**
 * Profile Intelligence System v2
 * Système de renseignement opérateur - séparé de Mem0
 */

// Orchestrateur principal
export { profileOrchestrator, ProfileExtractionOrchestrator } from './orchestrator'

// Types
export type {
    ExtractionContext,
    MessageForExtraction,
    ExistingProfile,
    FullExtractionResult,
    ExtractedAttribute,
    ExtractionLog,
    IdentityExtraction,
    SocialExtraction,
    PsychologyExtraction,
    FinancialExtraction
} from './types'

// Utilitaires
export { deduplicateAttributes, detectContradictions } from './deduplicator'
export { 
    calculateGlobalConfidence, 
    calculateConfidenceBreakdown,
    getConfidenceLabel,
    calculateAttributeConfidence 
} from './confidence-scorer'
export { robustJsonParse, robustJsonArrayParse } from './json-parser'

// Prompts (si besoin de customisation)
export {
    IDENTITY_PROMPT,
    SOCIAL_PROMPT,
    CONTEXT_PROMPT,
    INTEREST_PROMPT,
    PSYCHOLOGY_PROMPT,
    FINANCIAL_PROMPT,
    ATTRIBUTE_SYNTHESIS_PROMPT
} from './prompts'

/**
 * Fonction helper pour extraction rapide
 */
import { profileOrchestrator } from './orchestrator'
import { prisma } from '@/lib/prisma'

export async function extractContactProfile(
    contactId: string,
    agentId: string,
    options: { messageCount?: number; triggeredBy?: 'auto' | 'manual' | 'ai' } = {}
): Promise<{ success: boolean; confidence?: number; error?: string }> {
    
    try {
        const { messageCount = 50, triggeredBy = 'manual' } = options
        
        // Récupérer les messages
        const conversation = await prisma.conversation.findFirst({
            where: { contactId, agentId },
            orderBy: { createdAt: 'desc' }
        })
        
        if (!conversation) {
            return { success: false, error: 'No conversation found' }
        }
        
        const messages = await prisma.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { timestamp: 'desc' },
            take: messageCount
        })
        
        if (messages.length === 0) {
            return { success: false, error: 'No messages to analyze' }
        }
        
        // Récupérer le profil existant pour déduplication
        const existingProfile = await prisma.contactProfile.findUnique({
            where: { contactId },
            include: {
                attributes: { select: { key: true, value: true, category: true, confidence: true } },
                relationships: { select: { relationType: true, name: true } },
                events: { select: { title: true, eventType: true } },
                interests: { select: { category: true, name: true } },
                psychology: true,
                financial: true
            }
        })
        
        // Exécuter l'extraction
        const result = await profileOrchestrator.extractFullProfile({
            contactId,
            agentId,
            messages: messages.reverse().map(m => ({
                id: m.id,
                sender: m.sender as 'contact' | 'ai' | 'admin',
                text: m.message_text,
                timestamp: m.timestamp
            })),
            existingProfile: existingProfile ? {
                attributes: existingProfile.attributes,
                relationships: existingProfile.relationships,
                events: existingProfile.events,
                interests: existingProfile.interests,
                psychology: existingProfile.psychology ? {
                    emotionalState: existingProfile.psychology.emotionalState,
                    vulnerabilities: existingProfile.psychology.vulnerabilities
                } : null,
                financial: existingProfile.financial ? {
                    situation: existingProfile.financial.situation,
                    urgentNeeds: existingProfile.financial.urgentNeeds
                } : null
            } : null
        })
        
        // Sauvegarder
        await profileOrchestrator.saveExtraction(contactId, result, {
            triggeredBy,
            messageRange: `${messages[0].id} to ${messages[messages.length - 1].id}`,
            attributesFound: result.attributes.length,
            relationshipsFound: result.social.relationships.length,
            eventsFound: result.context.events.length,
            newInfoCount: result.attributes.length,
            updatedInfoCount: 0,
            rejectedCount: 0,
            processingTimeMs: result.processingTimeMs
        })
        
        return {
            success: true,
            confidence: Math.round(
                (result.identity.age ? 20 : 0) +
                (result.identity.city ? 15 : 0) +
                (result.psychology.vulnerabilities.length * 10) +
                (result.financial.urgentNeeds.length * 15)
            )
        }
        
    } catch (error: any) {
        console.error('[extractContactProfile] Failed:', error)
        return { success: false, error: error.message }
    }
}
