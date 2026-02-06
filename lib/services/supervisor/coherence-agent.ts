/**
 * Coherence Agent
 * Détecte les problèmes de cohérence de l'IA via analyse LLM (Venice)
 * - Répétitions excessives
 * - Fuite de prompts/system
 * - Hallucinations
 * - Rupture de persona
 */

import { venice } from '@/lib/venice';
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

        // Analyse LLM complète - détection intelligente
        const aiAlerts = await this.aiAnalysis(context);
        alerts.push(...aiAlerts);

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
     * Analyse LLM complète avec Venice
     * Détecte tous les problèmes de cohérence
     */
    async aiAnalysis(context: AnalysisContext): Promise<SupervisorAlert[]> {
        const alerts: SupervisorAlert[] = [];
        const { aiResponse, history, agentId, conversationId, contactId, phase, pendingQueue } = context;

        const settings = await settingsService.getSettings();
        const apiKey = settings.venice_api_key;

        if (!apiKey) {
            console.warn('[CoherenceAgent] No Venice API key, skipping AI analysis');
            return alerts;
        }

        // Construire l'historique pour le contexte
        const recentHistory = history.slice(-10);
        const historyText = recentHistory
            .map(h => `${h.role === 'user' ? 'USER' : 'AI'}: ${h.content}`)
            .join('\n');

        // Construire le contexte des messages en queue
        const queueText = pendingQueue && pendingQueue.length > 0
            ? pendingQueue.map(q => `- [${new Date(q.scheduledAt).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}]: "${q.content.substring(0, 80)}${q.content.length > 80 ? '...' : ''}"`).join('\n')
            : '(Aucun message en attente)';

        const analysisPrompt = `Tu es un superviseur strict qui analyse la cohérence et la qualité d'une réponse d'IA jouant le rôle d'une adolescente (16-18 ans) dans une conversation WhatsApp.

CONTEXTE:
- L'IA incarne une ado de 16-18 ans
- Phase actuelle: ${phase || 'inconnue'}
- Style attendu: langage adolescent naturel, abréviations, émojis, ton décontracté

HISTORIQUE RÉCENT:
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
6. COHÉRENCE GLOBALE: La réponse est-elle globalement cohérente avec le persona ado ?

EXEMPLES DE PROBLÈMES:
- "Je suis une IA" / "mon programming" / "mes instructions" = SYSTEM LEAK (CRITICAL)
- "mdr" répété 10 fois = RÉPÉTITION EXCESSIVE
- "Je vous prie de bien vouloir..." = PERSONA BREAK (trop formel)
- "Mon frère m'a dit que..." sans contexte = HALLUCINATION
- Réponse identique au message précédent = RÉPÉTITION
- Message en queue dit "je suis fatiguée" et réponse actuelle dit "je viens de me réveiller" = COHÉRENCE QUEUE (contradiction)

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
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "explanation": string,         // Explication de l'analyse
  "confidence": number           // 0.0 à 1.0
}

RÈGLES STRICTES:
- SYSTEM LEAK = CRITICAL (mettre shouldPause à true)
- Répétition excessive (>5 fois même expression) = HIGH
- Persona break flagrant = HIGH
- Incohérence avec messages en queue = HIGH
- Hallucination mineure = MEDIUM
- Sois EXTRÊMEMENT strict sur la détection des fuites système`;

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
