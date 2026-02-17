/**
 * Coherence Agent
 * Détecte les problèmes de cohérence de l'IA via analyse LLM (Venice)
 * - Répétitions excessives
 * - Fuite de prompts/system
 * - Hallucinations
 * - Rupture de persona
 */

import { venice } from '@/lib/venice';
import { prisma } from '@/lib/prisma';
import { settingsService } from '@/lib/settings-cache';
import type {
    AnalysisContext,
    AgentAnalysisResult,
    SupervisorAlert,
    CoherenceEvidence
} from './types';

export const coherenceAgent = {
    name: 'COHERENCE' as const,

    async analyze(context: AnalysisContext): Promise<AgentAnalysisResult> {
        const alerts: SupervisorAlert[] = [];
        const { aiResponse, history, agentId, conversationId, contactId } = context;

        // ═══════════════════════════════════════════════════════════════════════════
        // DÉTECTION PROGRAMMATIQUE RAPIDE (avant LLM)
        // ═══════════════════════════════════════════════════════════════════════════

        // 1. Détection de répétition EXACTE
        const lastAiMessages = history
            .filter(h => h.role === 'ai')
            .slice(-3)
            .map(h => h.content.trim().toLowerCase());

        if (lastAiMessages.length > 0) {
            const currentNormalized = aiResponse.trim().toLowerCase();

            // Répétition exacte
            if (lastAiMessages.some(msg => msg === currentNormalized)) {
                alerts.push({
                    agentId,
                    conversationId,
                    contactId,
                    agentType: 'COHERENCE',
                    alertType: 'REPETITION',
                    severity: 'HIGH',
                    title: '🚨 RÉPÉTITION EXACTE DÉTECTÉE',
                    description: `L'IA a répété exactement la même réponse que précédemment: "${aiResponse.substring(0, 50)}..."`,
                    evidence: { repeatedPhrases: [aiResponse], type: 'EXACT_DUPLICATE' } as Record<string, any>
                });
            }

            // Similarité élevée (>85%)
            for (const prevMsg of lastAiMessages) {
                const similarity = this.calculateSimilarity(currentNormalized, prevMsg);
                if (similarity > 0.85) {
                    alerts.push({
                        agentId,
                        conversationId,
                        contactId,
                        agentType: 'COHERENCE',
                        alertType: 'REPETITION',
                        severity: 'HIGH',
                        title: 'Répétition quasi-identique détectée',
                        description: `Similarité de ${Math.round(similarity * 100)}% avec un message précédent`,
                        evidence: { similarity, previous: prevMsg, current: aiResponse } as Record<string, any>
                    });
                    break;
                }
            }
        }

        // 2. Détection de troncature
        const truncationPatterns = /\b(moi|je|tu|il|elle|nous|vous|ils|elles|et|ou|mais|donc|car|que|qui|où|the|i|you|he|she|we|they|and|but|or|so|because|that|who|where)\s*$/i;
        if (truncationPatterns.test(aiResponse.trim())) {
            alerts.push({
                agentId,
                conversationId,
                contactId,
                agentType: 'COHERENCE',
                alertType: 'TRUNCATION',
                severity: 'HIGH',
                title: 'Message tronqué détecté',
                description: `La réponse semble incomplète (se termine par un pronom/conjonction): "${aiResponse}"`,
                evidence: { type: 'TRUNCATED_ENDING' } as Record<string, any>
            });
        }

        // 3. Détection d'artifacts
        if (/^\*+$/.test(aiResponse.trim()) ||
            /^`+$/.test(aiResponse.trim()) ||
            aiResponse.trim().length < 2) {
            alerts.push({
                agentId,
                conversationId,
                contactId,
                agentType: 'COHERENCE',
                alertType: 'ARTIFACT',
                severity: 'HIGH', // HIGH = triggers regeneration, but NOT auto-pause
                title: '🚨 Artifacts de formatting détectés',
                description: `Réponse invalide: "${aiResponse}"`,
                evidence: { type: 'FORMATTING_ARTIFACT' } as Record<string, any>
            });
        }

        // 4. Détection de patterns répétitifs fréquents
        const repetitivePhrases = ['be patient', 'love', 'bb', 'bébé', 'tkt', 'jsuis là'];
        const phraseCount: Record<string, number> = {};

        for (const phrase of repetitivePhrases) {
            const regex = new RegExp(phrase, 'gi');
            const matches = (aiResponse.match(regex) || []).length;

            // Compter aussi dans l'historique récent
            const historyMatches = history
                .filter(h => h.role === 'ai')
                .slice(-5)
                .reduce((count, h) => count + ((h.content.match(regex) || []).length), 0);

            if (matches > 0 && historyMatches > 2) {
                alerts.push({
                    agentId,
                    conversationId,
                    contactId,
                    agentType: 'COHERENCE',
                    alertType: 'REPETITION',
                    severity: 'HIGH',
                    title: `Pattern répétitif détecté: "${phrase}"`,
                    description: `Expression "${phrase}" utilisée ${historyMatches + matches} fois dans les derniers messages`,
                    evidence: { phrase, count: historyMatches + matches } as Record<string, any>
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════════════════
        // Analyse LLM complète - détection intelligente (backup)
        // ═══════════════════════════════════════════════════════════════════════════
        const aiAlerts = await this.aiAnalysis(context);

        // Fusionner sans doublons (basé sur alertType)
        const existingTypes = new Set(alerts.map(a => a.alertType));
        for (const alert of aiAlerts) {
            if (!existingTypes.has(alert.alertType)) {
                alerts.push(alert);
            }
        }

        // CRITICAL = pause auto
        const shouldPause = alerts.some(a => a.severity === 'CRITICAL');

        return {
            alerts,
            shouldPause,
            confidence: alerts.length > 0 ? Math.max(...alerts.map(a =>
                a.severity === 'CRITICAL' ? 0.95 :
                    a.severity === 'HIGH' ? 0.85 :
                        a.severity === 'MEDIUM' ? 0.75 : 0.65
            )) : 0
        };
    },

    /**
     * Calcule la similarité entre deux strings (coefficient de Jaccard simplifié)
     */
    calculateSimilarity(str1: string, str2: string): number {
        const words1 = new Set(str1.toLowerCase().split(/\s+/));
        const words2 = new Set(str2.toLowerCase().split(/\s+/));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size;
    },

    /**
     * Analyse LLM complète avec Venice
     * Détecte tous les problèmes de cohérence
     */
    async aiAnalysis(context: AnalysisContext): Promise<SupervisorAlert[]> {
        const alerts: SupervisorAlert[] = [];
        const { aiResponse, history, agentId, conversationId, contactId, phase, pendingQueue, currentActivity } = context;

        const settings = await settingsService.getSettings();
        const apiKey = settings.venice_api_key;

        if (!apiKey) {
            console.warn('[CoherenceAgent] No Venice API key, skipping AI analysis');
            return alerts;
        }

        // Récupérer le profil du contact pour vérifier les contradictions
        let profileText = '';
        if (contactId) {
            const contact = await prisma.contact.findUnique({
                where: { id: contactId },
                select: { profile: true }
            });
            if (contact?.profile) {
                const profile = contact.profile as Record<string, any>;
                profileText = Object.entries(profile)
                    .filter(([_, v]) => v !== undefined && v !== null)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join('\n');
            }
        }

        // Construire l'historique pour le contexte
        const recentHistory = history.slice(-10);
        const historyText = recentHistory
            .map(h => `${h.role === 'user' ? 'USER' : 'AI'}: ${h.content}`)
            .join('\n');

        // Construire le contexte des messages en queue
        const queueText = pendingQueue && pendingQueue.length > 0
            ? pendingQueue.map(q => `- [${new Date(q.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}]: "${q.content.substring(0, 80)}${q.content.length > 80 ? '...' : ''}"`).join('\n')
            : '(Aucun message en attente)';

        const analysisPrompt = `Tu es un superviseur strict qui analyse la cohérence et la qualité d'une réponse d'IA jouant le rôle d'une adolescente (16-18 ans) dans une conversation WhatsApp.

CONTEXTE:
- L'IA incarne une ado de 16-18 ans
- Phase actuelle: ${phase || 'inconnue'}
- Style attendu: langage adolescent naturel, abréviations, émojis, ton décontracté
${currentActivity ? `- 📅 ACTIVITÉ ACTUELLE DU PLANNING: ${currentActivity.name} (${currentActivity.description}) — Statut: ${currentActivity.status}` : ''}

${profileText ? `PROFIL ÉTABLI (à respecter impérativement):
${profileText}

` : ''}HISTORIQUE RÉCENT:
${historyText || '(Début de conversation)'}

${pendingQueue && pendingQueue.length > 0 ? `MESSAGES DÉJÀ EN FILE D'ATTENTE (seront envoyés plus tard):
${queueText}

⚠️ IMPORTANT: Vérifie que la réponse actuelle est cohérente avec ces messages en attente. Pas de contradictions !
` : ''}
RÉPONSE À ANALYSER:
"""${aiResponse}"""

ANALYSE REQUISE:
1. SYSTEM LEAK: L'IA révèle-t-elle qu'elle est une IA, un programme, ou mentionne-t-elle des instructions/prompts ?
2. RÉPÉTITION: L'IA répète-t-elle excessivement les mêmes expressions/mots dans la conversation OU par rapport aux messages en queue ?
3. PERSONA BREAK: L'IA parle-t-elle comme une adulte, trop formelle, ou robotique ?
4. HALLUCINATION: L'IA invente-t-elle des événements, personnes, ou détails sans fondement ?
5. COHÉRENCE QUEUE: La réponse est-elle cohérente avec les messages en file d'attente ? (Pas de contradictions, pas de répétitions)
6. COHÉRENCE PROFIL: La réponse contredit-elle le PROFIL ÉTABLI ci-dessus ? (âge, ville, métier, etc.)
7. COHÉRENCE GLOBALE: La réponse est-elle globalement cohérente avec le persona ado ?

EXEMPLES DE PROBLÈMES:
- "Je suis une IA" / "mon programming" / "mes instructions" = SYSTEM LEAK (CRITICAL)
- "mdr" répété 10 fois = RÉPÉTITION EXCESSIVE
- "Je vous prie de bien vouloir..." = PERSONA BREAK (trop formel)
- "Mon frère m'a dit que..." sans contexte = HALLUCINATION
- Réponse identique au message précédent = RÉPÉTITION
- Message en queue dit "je suis fatiguée" et réponse actuelle dit "je viens de me réveiller" = COHÉRENCE QUEUE (contradiction)
- Profil: age=17 et IA dit "j'ai 18 ans" = COHÉRENCE PROFIL (CRITICAL)
- Profil: city=Paris et IA dit "j'habite à Lyon" = COHÉRENCE PROFIL (HIGH)

Réponds UNIQUEMENT en JSON valide:
{
  "systemLeak": boolean,         // true si fuite de prompt/instruction
  "systemLeakContent": string | null,  // Contenu qui a fuité
  "repetition": boolean,         // true si répétition excessive détectée
  "repeatedPhrases": string[],   // Phrases/expressions répétées
  "personaBreak": boolean,       // true si ton inapproprié
  "personaIssue": string | null, // Description du problème de ton
  "hallucination": boolean,      // true si invention de faits
  "hallucinationDetails": string | null, // Détails de l'hallucination
  "queueIncoherence": boolean,   // true si contradiction avec messages en queue
  "queueIncoherenceDetails": string | null, // Détails de l'incohérence
  "profileContradiction": boolean, // true si contradiction avec le profil établi
  "profileContradictionField": string | null, // Champ concerné (age, city, job, etc.)
  "profileContradictionDetails": string | null, // Détails de la contradiction
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "explanation": string,         // Explication de l'analyse
  "confidence": number           // 0.0 à 1.0
}

RÈGLES STRICTES:
- SYSTEM LEAK = CRITICAL (mettre shouldPause à true)
- CONTRADICTION DE PROFIL (âge, ville, métier) = CRITICAL
- Répétition excessive (>5 fois même expression) = HIGH
- Persona break flagrant = HIGH
- Incohérence avec messages en queue = HIGH
- Hallucination mineure = MEDIUM
- Sois EXTRÊMEMENT strict sur la détection des fuites système ET des contradictions de profil
${currentActivity ? `- ⚠️ PLANNING DE VIE: L'IA est censée être en "${currentActivity.name}" (${currentActivity.status}) en ce moment. NE SIGNALE PAS de contradiction si la réponse est COHÉRENTE avec ce planning (ex: si le planning dit SLEEP, l'IA peut dire qu'elle dort — ce n'est PAS une contradiction).` : ''}`;

        let response = '';

        try {
            response = await venice.chatCompletion(
                analysisPrompt,
                [],
                'Analyse cohérence réponse IA',
                {
                    apiKey,
                    model: 'llama-3.3-70b', // Venice medium
                    temperature: 0.05,       // Très faible pour plus de précision
                    max_tokens: 600
                }
            );

            // Nettoyer la réponse JSON
            let cleanJson = response
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();

            // Extraire JSON si encapsulé
            const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanJson = jsonMatch[0];
            }

            const analysis = JSON.parse(cleanJson);

            // Log pour debug
            console.log('[CoherenceAgent] LLM Analysis:', {
                systemLeak: analysis.systemLeak,
                repetition: analysis.repetition,
                personaBreak: analysis.personaBreak,
                hallucination: analysis.hallucination,
                confidence: analysis.confidence
            });

            // Générer les alertes selon les problèmes détectés
            if (analysis.confidence > 0.75) {
                // 1. System Leak (CRITICAL)
                if (analysis.systemLeak) {
                    const evidence: CoherenceEvidence = {
                        leakedContent: analysis.systemLeakContent || 'Contenu système détecté',
                        leakType: 'SYSTEM'
                    };

                    alerts.push({
                        agentId,
                        conversationId,
                        contactId,
                        agentType: 'COHERENCE',
                        alertType: 'SYSTEM_LEAK',
                        severity: 'CRITICAL',
                        title: '🚨 SYSTEM LEAK DÉTECTÉ',
                        description: `[Confiance: ${Math.round(analysis.confidence * 100)}%] ${analysis.explanation || "L'IA a révélé son prompt/system"}`,
                        evidence: evidence as Record<string, any>
                    });
                }

                // 2. Répétition excessive
                if (analysis.repetition) {
                    const evidence: CoherenceEvidence = {
                        repeatedPhrases: analysis.repeatedPhrases || ['Expression répétée'],
                        repeatedCount: analysis.repeatedPhrases?.length || 1
                    };

                    alerts.push({
                        agentId,
                        conversationId,
                        contactId,
                        agentType: 'COHERENCE',
                        alertType: 'REPETITION',
                        severity: 'HIGH',
                        title: 'Répétition excessive détectée',
                        description: `[Confiance: ${Math.round(analysis.confidence * 100)}%] ${analysis.explanation || "L'IA répète excessivement les mêmes expressions"}`,
                        evidence: evidence as Record<string, any>
                    });
                }

                // 3. Persona Break
                if (analysis.personaBreak) {
                    const evidence: CoherenceEvidence = {
                        personaBreak: analysis.personaIssue || 'Ton inapproprié détecté',
                        expectedPersona: 'Adolescente 16-18 ans',
                        actualTone: analysis.personaIssue || 'Trop formel/adulte'
                    };

                    alerts.push({
                        agentId,
                        conversationId,
                        contactId,
                        agentType: 'COHERENCE',
                        alertType: 'PERSONA_BREAK',
                        severity: 'HIGH',
                        title: 'Rupture de persona détectée',
                        description: `[Confiance: ${Math.round(analysis.confidence * 100)}%] ${analysis.explanation || analysis.personaIssue || "L'IA ne parle plus comme une ado"}`,
                        evidence: evidence as Record<string, any>
                    });
                }

                // 4. Hallucination
                if (analysis.hallucination) {
                    const evidence: CoherenceEvidence = {
                        hallucination: analysis.hallucinationDetails || 'Hallucination détectée'
                    };

                    alerts.push({
                        agentId,
                        conversationId,
                        contactId,
                        agentType: 'COHERENCE',
                        alertType: 'HALLUCINATION',
                        severity: analysis.severity === 'CRITICAL' ? 'CRITICAL' : 'MEDIUM',
                        title: 'Hallucination détectée',
                        description: `[Confiance: ${Math.round(analysis.confidence * 100)}%] ${analysis.explanation || analysis.hallucinationDetails || "L'IA invente des éléments sans contexte"}`,
                        evidence: evidence as Record<string, any>
                    });
                }

                // 5. Incohérence avec messages en queue
                if (analysis.queueIncoherence) {
                    const evidence: CoherenceEvidence = {
                        hallucination: analysis.queueIncoherenceDetails || 'Incohérence avec messages en queue'
                    };

                    alerts.push({
                        agentId,
                        conversationId,
                        contactId,
                        agentType: 'COHERENCE',
                        alertType: 'HALLUCINATION',  // On réutilise HALLUCINATION pour l'incohérence
                        severity: 'HIGH',
                        title: 'Incohérence avec messages en queue',
                        description: `[Confiance: ${Math.round(analysis.confidence * 100)}%] ${analysis.queueIncoherenceDetails || analysis.explanation || "La réponse est incohérente avec les messages en file d'attente"}`,
                        evidence: evidence as Record<string, any>
                    });
                }

                // 6. Contradiction avec le profil établi
                if (analysis.profileContradiction) {
                    const evidence: CoherenceEvidence = {
                        hallucination: analysis.profileContradictionDetails || 'Contradiction avec le profil établi',
                        personaBreak: analysis.profileContradictionField || 'champ inconnu'
                    };

                    alerts.push({
                        agentId,
                        conversationId,
                        contactId,
                        agentType: 'COHERENCE',
                        alertType: 'PERSONA_BREAK',
                        severity: 'CRITICAL',
                        title: `🚨 Contradiction de profil: ${analysis.profileContradictionField || 'générale'}`,
                        description: `[Confiance: ${Math.round(analysis.confidence * 100)}%] ${analysis.profileContradictionDetails || analysis.explanation || "La réponse contredit le profil établi du contact"}`,
                        evidence: evidence as Record<string, any>
                    });
                }
            }
        } catch (error) {
            console.error('[CoherenceAgent] LLM analysis failed:', error);
            if (response) {
                console.error('[CoherenceAgent] Raw response:', response);
            }
        }

        return alerts;
    }
};
