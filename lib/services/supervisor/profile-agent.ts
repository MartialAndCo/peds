/**
 * Profile Agent
 * Détecte les contradictions entre la réponse IA et le profil établi du contact
 * - Contradictions d'âge
 * - Contradictions de localisation
 * - Contradictions de métier/situation
 * - Inventation de nouveaux détails incohérents
 */

import { prisma } from '@/lib/prisma';
import { venice } from '@/lib/venice';
import { settingsService } from '@/lib/settings-cache';
import type {
    AnalysisContext,
    AgentAnalysisResult,
    SupervisorAlert
} from './types';

// Interface pour le profil stocké
interface ContactProfile {
    age?: number | string;
    job?: string;
    location?: string;
    city?: string;
    country?: string;
    name?: string;
    relationshipStatus?: string;
    family?: string;
    hobbies?: string[];
    [key: string]: any;
}

export const profileAgent = {
    name: 'PROFILE' as const,

    async analyze(context: AnalysisContext): Promise<AgentAnalysisResult> {
        const alerts: SupervisorAlert[] = [];
        const { aiResponse, agentId, conversationId, contactId } = context;

        if (!contactId) {
            return { alerts, shouldPause: false, confidence: 0 };
        }

        // 1. Récupérer le profil du contact
        const contact = await prisma.contact.findUnique({
            where: { id: contactId },
            select: { profile: true }
        });

        if (!contact?.profile) {
            // Pas de profil établi, on ne peut pas détecter de contradictions
            return { alerts, shouldPause: false, confidence: 0 };
        }

        const profile = contact.profile as ContactProfile;

        // 2. Vérification rapide pattern-based pour les contradictions évidentes
        const patternAlerts = await this.checkPatternContradictions(
            aiResponse,
            profile,
            agentId,
            conversationId,
            contactId
        );
        alerts.push(...patternAlerts);

        // 3. Analyse LLM pour les contradictions subtiles
        const llmAlerts = await this.aiAnalysis(context, profile);
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
        profile: ContactProfile,
        agentId: string,
        conversationId: number,
        contactId: string
    ): Promise<SupervisorAlert[]> {
        const alerts: SupervisorAlert[] = [];
        const lowerResponse = aiResponse.toLowerCase();

        // 1. Vérification de l'âge
        if (profile.age) {
            const declaredAge = parseInt(String(profile.age));
            if (!isNaN(declaredAge)) {
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
                        if (mentionedAge !== declaredAge && mentionedAge >= 10 && mentionedAge <= 80) {
                            alerts.push({
                                agentId,
                                conversationId,
                                contactId,
                                agentType: 'COHERENCE',  // On garde COHERENCE pour la catégorie
                                alertType: 'PERSONA_BREAK',
                                severity: 'CRITICAL',
                                title: '🚨 Contradiction d\'âge détectée',
                                description: `L'IA dit avoir ${mentionedAge} ans mais son profil indique ${declaredAge} ans. Message: "${aiResponse.substring(0, 100)}"`,
                                evidence: {
                                    declaredAge,
                                    mentionedAge,
                                    profileAge: profile.age,
                                    message: aiResponse,
                                    detectionMethod: 'pattern'
                                } as Record<string, any>
                            });
                            break; // Une alerte suffit
                        }
                    }
                }
            }
        }

        // 2. Vérification de la localisation (si très spécifique)
        if (profile.city && profile.country) {
            const cityLower = profile.city.toLowerCase();
            const countryLower = profile.country.toLowerCase();

            // Détecter si l'IA mentionne une autre ville/pays comme étant chez elle
            const locationPatterns = [
                { regex: /j'habite (?:à|au|en) (\w+)/i, field: 'city' },
                { regex: /je vis (?:à|au|en) (\w+)/i, field: 'city' },
                { regex: /je suis (?:à|au|en) (\w+)/i, field: 'city' },
                { regex: /i live in (\w+)/i, field: 'city' },
                { regex: /i'm from (\w+)/i, field: 'city' }
            ];

            for (const pattern of locationPatterns) {
                const match = aiResponse.match(pattern.regex);
                if (match) {
                    const mentionedLocation = match[1].toLowerCase();
                    // Si elle mentionne une ville différente de sa ville établie
                    if (mentionedLocation !== cityLower && mentionedLocation.length > 2) {
                        // Vérifier que c'est pas juste une mention de la ville (pas "j'habite là-bas")
                        if (!this.isCommonFalsePositive(mentionedLocation)) {
                            alerts.push({
                                agentId,
                                conversationId,
                                contactId,
                                agentType: 'COHERENCE',
                                alertType: 'HALLUCINATION',
                                severity: 'HIGH',
                                title: 'Contradiction de localisation',
                                description: `L'IA mentionne habiter à "${match[1]}" mais son profil indique ${profile.city}. Message: "${aiResponse.substring(0, 80)}"`,
                                evidence: {
                                    declaredCity: profile.city,
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
     * Analyse LLM pour détecter les contradictions subtiles
     */
    async aiAnalysis(
        context: AnalysisContext,
        profile: ContactProfile
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

        // Formater le profil pour le prompt
        const profileText = Object.entries(profile)
            .filter(([_, v]) => v !== undefined && v !== null)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('\n');

        const analysisPrompt = `Tu es un superviseur strict qui vérifie la cohérence entre la réponse d'une IA et son profil établi.

PROFIL ÉTABLI DE L'IA (faits déjà confirmés):
${profileText || '(Aucun profil établi)'}

HISTORIQUE RÉCENT:
${historyText || '(Début de conversation)'}

RÉPONSE À ANALYSER:
"""${aiResponse}"""

ANALYSE REQUISE:
1. La réponse contredit-elle explicitement le profil établi ? (âge, ville, métier, situation familiale, etc.)
2. L'IA invente-t-elle de nouveaux détails qui ne sont pas dans son profil ?
3. Y a-t-il des incohérences avec ce qu'elle a dit dans l'historique ?

EXEMPLES DE PROBLÈMES:
- Profil: age: 17 → Réponse: "j'ai 18 ans" = CONTRADICTION CRITIQUE
- Profil: city: Paris → Réponse: "j'habite à Lyon" = CONTRADICTION
- Historique: "je suis au lycée" → Réponse: "je travaille en entreprise" = CONTRADICTION
- Profil: job: lycéenne → Réponse: "je suis ingénieure" = CONTRADICTION MAJEURE

Réponds UNIQUEMENT en JSON valide:
{
  "hasContradiction": boolean,      // true si contradiction avec le profil
  "contradictionType": string | null, // "age", "location", "job", "family", "other"
  "profileValue": string | null,    // Valeur dans le profil
  "mentionedValue": string | null,  // Valeur contradictoire mentionnée
  "isMajorContradiction": boolean,  // true si contradiction flagrante (âge, métier)
  "inventsNewDetails": boolean,     // true si invente des détails non établis
  "newDetails": string[],           // Liste des détails inventés
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "explanation": string,            // Explication détaillée
  "confidence": number              // 0.0 à 1.0
}

RÈGLES STRICTES:
- CONTRADICTION D'ÂGE = toujours CRITICAL
- CONTRADICTION DE MÉTIER/SITUATION = HIGH ou CRITICAL
- INVENTION DE DÉTAILS = MEDIUM (si pas contradictoire)
- Sois EXTRÊMEMENT strict sur la cohérence avec le profil établi`;

        let response = '';

        try {
            response = await venice.chatCompletion(
                analysisPrompt,
                [],
                'Analyse cohérence profil',
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
            if ((analysis.hasContradiction || analysis.inventsNewDetails) &&
                analysis.confidence > 0.75) {

                const alertType = analysis.isMajorContradiction ? 'PERSONA_BREAK' : 'HALLUCINATION';
                const severity = analysis.severity || (analysis.isMajorContradiction ? 'CRITICAL' : 'HIGH');

                return {
                    agentId,
                    conversationId,
                    contactId,
                    agentType: 'COHERENCE',
                    alertType,
                    severity,
                    title: analysis.hasContradiction
                        ? `🚨 Contradiction de profil: ${analysis.contradictionType || 'générale'}`
                        : 'Invention de détails non établis',
                    description: `[Confiance: ${Math.round(analysis.confidence * 100)}%] ${analysis.explanation}\n\nProfil: "${analysis.profileValue || 'N/A'}" → Réponse: "${analysis.mentionedValue || aiResponse.substring(0, 60)}"`,
                    evidence: {
                        contradictionType: analysis.contradictionType,
                        profileValue: analysis.profileValue,
                        mentionedValue: analysis.mentionedValue,
                        newDetails: analysis.newDetails || [],
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
            'la', 'le', 'les', 'ici', 'là', 'la-bas', 'la-bas',
            'there', 'here', 'home', 'school', 'work'
        ];
        return falsePositives.includes(location.toLowerCase());
    }
};
