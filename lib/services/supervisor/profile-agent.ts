/**
 * Profile Agent
 * Détecte les contradictions entre la réponse IA et son PROPRE profil d'agent
 * - L'IA ne doit pas se contredire sur son âge (baseAge dans AgentProfile)
 * - L'IA ne doit pas se contredire sur sa localisation
 * - L'IA ne doit pas inventer des détails incohérents avec son persona
 */

import { prisma } from '@/lib/prisma';
import { venice } from '@/lib/venice';
import { settingsService } from '@/lib/settings-cache';
import type {
    AnalysisContext,
    AgentAnalysisResult,
    SupervisorAlert
} from './types';

// Interface pour l'AgentProfile
interface AgentProfile {
    baseAge?: number;
    locale?: string;
    timezone?: string;
    location?: string;
    city?: string;
    bio?: string;
    identityTemplate?: string;
    contextTemplate?: string;
}

export const profileAgent = {
    name: 'PROFILE' as const,

    async analyze(context: AnalysisContext): Promise<AgentAnalysisResult> {
        const alerts: SupervisorAlert[] = [];
        const { aiResponse, agentId, conversationId, contactId } = context;

        if (!agentId) {
            return { alerts, shouldPause: false, confidence: 0 };
        }

        // 1. Récupérer le profil de L'AGENT (pas du contact)
        const agentProfile = await prisma.agentProfile.findUnique({
            where: { agentId }
        });

        if (!agentProfile) {
            console.warn(`[ProfileAgent] No AgentProfile found for agent ${agentId}`);
            return { alerts, shouldPause: false, confidence: 0 };
        }

        // 2. Vérification rapide pattern-based pour les contradictions évidentes
        const patternAlerts = await this.checkPatternContradictions(
            aiResponse,
            agentProfile,
            agentId,
            conversationId,
            contactId
        );
        alerts.push(...patternAlerts);

        // 3. Analyse LLM pour les contradictions subtiles
        const llmAlerts = await this.aiAnalysis(context, agentProfile);
        if (llmAlerts) {
            alerts.push(llmAlerts);
        }

        // CRITICAL si contradiction majeure détectée
        const hasCritical = alerts.some(a => a.severity === 'CRITICAL');

        return {
            alerts,
            shouldPause: hasCritical,
            confidence: alerts.length > 0 ? 0.9 : 0
        };
    },

    /**
     * Vérification rapide par patterns pour les contradictions évidentes
     */
    async checkPatternContradictions(
        aiResponse: string,
        agentProfile: AgentProfile,
        agentId: string,
        conversationId: number,
        contactId: string | null | undefined
    ): Promise<SupervisorAlert[]> {
        const alerts: SupervisorAlert[] = [];
        const lowerResponse = aiResponse.toLowerCase();

        // 1. Vérification de l'âge (baseAge dans AgentProfile)
        if (agentProfile.baseAge) {
            const declaredAge = agentProfile.baseAge;
            
            // Chercher des mentions d'âge différent dans la réponse
            const agePatterns = [
                { regex: /j'ai (\d+) ans/, type: 'fr' },
                { regex: /j'ai (\d+).ans/, type: 'fr' },
                { regex: /i'm (\d+) years? old/, type: 'en' },
                { regex: /i am (\d+) years? old/, type: 'en' },
                { regex: /(\d+) ans/, type: 'fr_ambiguous' },
                { regex: /(\d+) years? old/, type: 'en_ambiguous' }
            ];

            for (const pattern of agePatterns) {
                const match = lowerResponse.match(pattern.regex);
                if (match) {
                    const mentionedAge = parseInt(match[1]);
                    // Vérifier que c'est un âge plausible (10-25 ans pour une ado)
                    if (mentionedAge !== declaredAge && mentionedAge >= 10 && mentionedAge <= 25) {
                        alerts.push({
                            agentId,
                            conversationId,
                            contactId: contactId || null,
                            agentType: 'COHERENCE',
                            alertType: 'PERSONA_BREAK',
                            severity: 'CRITICAL',
                            title: '🚨 Contradiction d\'âge détectée',
                            description: `L'IA dit avoir ${mentionedAge} ans mais son profil indique ${declaredAge} ans (baseAge). Message: "${aiResponse.substring(0, 100)}"`,
                            evidence: {
                                declaredAge,
                                mentionedAge,
                                profileAge: agentProfile.baseAge,
                                message: aiResponse,
                                detectionMethod: 'pattern'
                            } as Record<string, any>
                        });
                        break; // Une alerte suffit
                    }
                }
            }
        }

        // 2. Vérification de la localisation (depuis contextTemplate ou location/city)
        const agentLocation = this.extractLocationFromProfile(agentProfile);
        if (agentLocation) {
            // Chercher si l'IA mentionne habiter ailleurs
            const locationPatterns = [
                { regex: /j'habite (?:à|au|en) (\w+)/i, field: 'city' },
                { regex: /je vis (?:à|au|en) (\w+)/i, field: 'city' },
                { regex: /je suis (?:de|d') (\w+)/i, field: 'origin' },
                { regex: /i live in (\w+)/i, field: 'city' },
                { regex: /i'm from (\w+)/i, field: 'city' }
            ];

            for (const pattern of locationPatterns) {
                const match = aiResponse.match(pattern.regex);
                if (match) {
                    const mentionedLocation = match[1].toLowerCase();
                    // Vérifier si c'est une ville différente de sa localisation établie
                    if (!agentLocation.toLowerCase().includes(mentionedLocation) && 
                        !mentionedLocation.includes(agentLocation.toLowerCase()) &&
                        mentionedLocation.length > 2) {
                        
                        // Vérifier que ce n'est pas un faux positif
                        if (!this.isCommonFalsePositive(mentionedLocation)) {
                            alerts.push({
                                agentId,
                                conversationId,
                                contactId: contactId || null,
                                agentType: 'COHERENCE',
                                alertType: 'HALLUCINATION',
                                severity: 'HIGH',
                                title: 'Contradiction de localisation',
                                description: `L'IA mentionne être de/à "${match[1]}" mais son profil indique "${agentLocation}". Message: "${aiResponse.substring(0, 80)}"`,
                                evidence: {
                                    declaredLocation: agentLocation,
                                    mentionedLocation: match[1],
                                    message: aiResponse
                                } as Record<string, any>
                            });
                            break;
                        }
                    }
                }
            }
        }

        return alerts;
    },

    /**
     * Construit un résumé compact du profil (sans les templates entiers)
     * pour économiser les tokens LLM
     */
    buildCompactProfileSummary(profile: AgentProfile): {
        baseAge: number | string;
        location: string;
        situation: string;
    } {
        // Âge
        const baseAge = profile.baseAge || 'Non spécifié';
        
        // Localisation (extraite rapidement sans tout le template)
        let location = 'Non spécifiée';
        if (profile.location) {
            location = profile.location;
        } else if (profile.city) {
            location = profile.city;
        } else if (profile.contextTemplate) {
            // Extraire seulement la première mention de localisation
            const match = profile.contextTemplate.match(/(?:habite|ville|région|banlieue|appartement)[\s\wàéèêëïîôùûç\-\(\)]{0,30}/i);
            if (match) {
                location = match[0].substring(0, 40); // Limiter la taille
            }
        }
        
        // Situation familiale (extraite du début du contextTemplate)
        let situation = 'Non spécifiée';
        if (profile.contextTemplate) {
            // Chercher des mots-clés sur la situation familiale
            const familyKeywords = [
                /mère célibataire/i,
                /père parti/i,
                /grand frère/i,
                /famille/i,
                /HLM/i,
                /appartement/i,
                /maison/i
            ];
            
            for (const pattern of familyKeywords) {
                const match = profile.contextTemplate.match(pattern);
                if (match) {
                    // Extraire un peu de contexte autour
                    const index = profile.contextTemplate.indexOf(match[0]);
                    const start = Math.max(0, index - 20);
                    const end = Math.min(profile.contextTemplate.length, index + match[0].length + 30);
                    situation = profile.contextTemplate.substring(start, end).replace(/\n/g, ' ').trim();
                    situation = situation.substring(0, 60); // Limiter
                    break;
                }
            }
        }
        
        return { baseAge, location, situation };
    }

    /**
     * Extrait la localisation depuis l'AgentProfile
     */
    extractLocationFromProfile(profile: AgentProfile): string | null {
        // Essayer de trouver la localisation dans différents champs
        if (profile.location) return profile.location;
        if (profile.city) return profile.city;
        
        // Essayer d'extraire du contextTemplate
        if (profile.contextTemplate) {
            // Pattern: "habites en banlieue parisienne (94)" ou "habites à Paris"
            const locationMatch = profile.contextTemplate.match(/habite[s]?(?: à| en| au)? ([^.,\n]+)/i);
            if (locationMatch) {
                return locationMatch[1].trim();
            }
            
            // Pattern: "région parisienne"
            const regionMatch = profile.contextTemplate.match(/(région \w+|banlieue \w+)/i);
            if (regionMatch) {
                return regionMatch[1].trim();
            }
        }
        
        // Essayer d'extraire de l'identityTemplate
        if (profile.identityTemplate) {
            const locationMatch = profile.identityTemplate.match(/(\d+\s*ans?)[,\s]+([^.,\n]+)/i);
            if (locationMatch) {
                return locationMatch[2].trim();
            }
        }
        
        return null;
    },

    /**
     * Analyse LLM pour détecter les contradictions subtiles
     */
    async aiAnalysis(
        context: AnalysisContext,
        agentProfile: AgentProfile
    ): Promise<SupervisorAlert | null> {
        const { aiResponse, history, agentId, conversationId, contactId } = context;

        const settings = await settingsService.getSettings();
        const apiKey = settings.venice_api_key;

        if (!apiKey) {
            console.warn('[ProfileAgent] No Venice API key, skipping AI analysis');
            return null;
        }

        // Construire l'historique récent
        const recentHistory = history.slice(-6);
        const historyText = recentHistory
            .map(h => `${h.role === 'user' ? 'USER' : 'AI'}: ${h.content}`)
            .join('\n');

        // Construire un résumé COMPACT du profil (pas tout le template!)
        const profileSummary = this.buildCompactProfileSummary(agentProfile);
        
        const profileText = `
ÂGE: ${profileSummary.baseAge} ans (FIXE - ne pas changer)
LOCALISATION: ${profileSummary.location}
SITUATION: ${profileSummary.situation}
        `.trim();

        const analysisPrompt = `Tu es un superviseur strict qui vérifie que l'IA ne se contredit pas avec SON PROPRE profil établi.

PROFIL DE L'IA (données fixes du personnage):
${profileText}

HISTORIQUE RÉCENT:
${historyText || '(Début de conversation)'}

RÉPONSE DE L'IA À VÉRIFIER:
"""${aiResponse}"""

ANALYSE REQUISE:
1. L'IA mentionne-t-elle un ÂGE différent de son profil (${agentProfile.baseAge || 'non défini'}) ?
2. L'IA mentionne-t-elle habiter ailleurs que sa localisation établie ?
3. L'IA invente-t-elle des détails familiaux/professionnels contradictoires ?
4. Y a-t-il des incohérences avec son persona d'adolescente ?

EXEMPLES DE PROBLÈMES CRITIQUES:
- Profil: 15 ans → Réponse: "j'ai 17 ans" = CONTRADICTION CRITIQUE
- Profil: habite à Paris → Réponse: "j'habite à Lyon" = CONTRADICTION
- Profil: lycéenne → Réponse: "je travaille en entreprise" = CONTRADICTION
- Profil: mère célibataire → Réponse: "mon père est là" = CONTRADICTION

Réponds UNIQUEMENT en JSON valide:
{
  "hasContradiction": boolean,      // true si contradiction avec le profil agent
  "contradictionType": string | null, // "age", "location", "family", "job", "other"
  "profileValue": string | null,    // Valeur dans le profil
  "mentionedValue": string | null,  // Valeur contradictoire mentionnée
  "isMajorContradiction": boolean,  // true si contradiction flagrante
  "inventsInconsistentDetails": boolean, // true si invente des détails contradictoires
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "explanation": string,            // Explication détaillée
  "confidence": number              // 0.0 à 1.0
}

RÈGLES STRICTES:
- CONTRADICTION D'ÂGE = toujours CRITICAL (même si proche, ex: 15 vs 17)
- CONTRADICTION DE LOCALISATION = HIGH
- INVENTION DE DÉTAILS FAMILIAUX CONTRADICTOIRES = HIGH
- Sois EXTRÊMEMENT strict sur la cohérence avec le profil établi`;

        let response = '';

        try {
            response = await venice.chatCompletion(
                analysisPrompt,
                [],
                'Analyse cohérence profil agent',
                {
                    apiKey,
                    model: 'llama-3.3-70b',
                    temperature: 0.05,
                    max_tokens: 500
                }
            );

            // Nettoyer la réponse JSON
            let cleanJson = response
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();

            const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanJson = jsonMatch[0];
            }

            const analysis = JSON.parse(cleanJson);

            // Log pour debug
            console.log('[ProfileAgent] LLM Analysis:', {
                hasContradiction: analysis.hasContradiction,
                contradictionType: analysis.contradictionType,
                severity: analysis.severity,
                confidence: analysis.confidence
            });

            // Déclencher alerte si problème détecté avec confiance suffisante
            if ((analysis.hasContradiction || analysis.inventsInconsistentDetails) &&
                analysis.confidence > 0.75) {

                const alertType = analysis.isMajorContradiction ? 'PERSONA_BREAK' : 'HALLUCINATION';
                const severity = analysis.severity || (analysis.isMajorContradiction ? 'CRITICAL' : 'HIGH');

                return {
                    agentId,
                    conversationId,
                    contactId: contactId || null,
                    agentType: 'COHERENCE',
                    alertType,
                    severity,
                    title: analysis.hasContradiction
                        ? `🚨 Contradiction de profil: ${analysis.contradictionType || 'générale'}`
                        : 'Invention de détails incohérents',
                    description: `[Confiance: ${Math.round(analysis.confidence * 100)}%] ${analysis.explanation}\n\nProfil: "${analysis.profileValue || 'N/A'}" → Réponse: "${analysis.mentionedValue || aiResponse.substring(0, 60)}"`,
                    evidence: {
                        contradictionType: analysis.contradictionType,
                        profileValue: analysis.profileValue,
                        mentionedValue: analysis.mentionedValue,
                        agentProfile: {
                            baseAge: agentProfile.baseAge,
                            location: this.extractLocationFromProfile(agentProfile)
                        },
                        message: aiResponse,
                        detectionMethod: 'llm'
                    } as Record<string, any>
                };
            }
        } catch (error) {
            console.error('[ProfileAgent] LLM analysis failed:', error);
            if (response) {
                console.error('[ProfileAgent] Raw response:', response);
            }
        }

        return null;
    },

    /**
     * Vérifie si une mention de localisation est un faux positif commun
     */
    isCommonFalsePositive(location: string): boolean {
        const falsePositives = [
            'la', 'le', 'les', 'ici', 'là', 'la-bas', 'labas',
            'there', 'here', 'home', 'school', 'work',
            'chez', 'moi', 'toit', 'maison'
        ];
        return falsePositives.includes(location.toLowerCase());
    }
};
