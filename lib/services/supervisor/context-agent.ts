/**
 * Context Agent
 * Détecte les problèmes de contexte via analyse LLM (Venice)
 * - Perte de contexte (réponses hors sujet)
 * - Sauts de sujet brutaux
 * - Réponses à des questions non posées
 */

import { venice } from '@/lib/venice';
import { settingsService } from '@/lib/settings-cache';
import type {
    AnalysisContext,
    AgentAnalysisResult,
    SupervisorAlert,
    ContextEvidence
} from './types';

export const contextAgent = {
    name: 'CONTEXT' as const,

    async analyze(context: AnalysisContext): Promise<AgentAnalysisResult> {
        const alerts: SupervisorAlert[] = [];

        // Analyse LLM principale - détection intelligente de l'incohérence
        const aiAlert = await this.aiAnalysis(context);
        if (aiAlert) {
            alerts.push(aiAlert);
        }

        return {
            alerts,
            shouldPause: alerts.some(a => a.severity === 'CRITICAL'),
            confidence: alerts.length > 0 ? 0.85 : 0
        };
    },

    /**
     * Analyse LLM complète avec Venice
     * Détecte toutes les formes d'incohérence contextuelle
     */
    async aiAnalysis(context: AnalysisContext): Promise<SupervisorAlert | null> {
        const { aiResponse, userMessage, history, agentId, conversationId, contactId, phase } = context;

        // Toujours analyser, même les messages courts peuvent être incohérents
        const settings = await settingsService.getSettings();
        const apiKey = settings.venice_api_key;

        if (!apiKey) {
            console.warn('[ContextAgent] No Venice API key, skipping AI analysis');
            return null;
        }

        // Construire un historique plus complet pour le contexte
        const recentHistory = history.slice(-8); // Augmenter pour plus de contexte
        const historyText = recentHistory
            .map(h => `${h.role === 'user' ? 'USER' : 'AI'}: ${h.content}`)
            .join('\n');

        const analysisPrompt = `Tu es un superviseur strict qui analyse la cohérence d'une conversation WhatsApp entre une ado et un contact.

CONTEXTE:
- L'IA joue le rôle d'une adolescente (16-18 ans)
- Phase actuelle de la relation: ${phase || 'inconnue'}
- La conversation doit être naturelle et cohérente

HISTORIQUE DE LA CONVERSATION:
${historyText || '(Début de conversation)'}

DERNIER MESSAGE DU CONTACT:
"""${userMessage}"""

RÉPONSE DE L'IA:
"""${aiResponse}"""

ANALYSE REQUISE:
1. La réponse de l'IA a-t-elle un SENS par rapport au dernier message du contact ?
2. L'IA semble-t-elle répondre à une AUTRE conversation (comme s'il y avait confusion de contexte) ?
3. Y a-t-il un décalage temporel flagrant (ex: contact dit "bonne nuit", IA parle de "manger") ?
4. L'IA ignore-t-elle complètement le message du contact ?
5. Y a-t-une rupture brutale de fil conversationnel ?

EXEMPLES D'INCOHÉRENCE (à détecter):
- Contact: "Bonne nuit" → IA: "Ouais ça va / je mange" = INCOHÉRENT (décalage temporel)
- Contact: "??" → IA présente son nom = INCOHÉRENT (mauvais contexte)
- Contact: parle de X → IA parle de Y sans lien = SAUT DE SUJET
- Contact pose question → IA répond à côté = PERTE DE CONTEXTE

Réponds UNIQUEMENT en JSON valide:
{
  "coherent": boolean,           // true si la réponse a du sens dans le contexte
  "contextLoss": boolean,        // true si l'IA répond à côté ou ignore le message
  "topicJump": boolean,          // true si changement brutal de sujet non justifié
  "wrongConversation": boolean,  // true si l'IA semble répondre à une autre conversation
  "issue": string | null,        // Description précise du problème
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "explanation": string,         // Explication de l'analyse
  "confidence": number           // 0.0 à 1.0
}

RÈGLES STRICTES:
- "contextLoss" = true si l'IA ne répond pas DU TOUT à ce que dit le contact
- "wrongConversation" = true si la réponse semble correspondre à un AUTRE moment de la conversation
- "topicJump" = true si changement de sujet brutal sans transition
- Sévérité CRITICAL si l'IA semble complètement perdue ou répond à une autre conversation
- Sois EXTRÊMEMENT strict sur la cohérence temporelle et contextuelle`;

        let response: string = '';

        try {
            response = await venice.chatCompletion(
                analysisPrompt,
                [],
                'Analyse cohérence contextuelle',
                {
                    apiKey,
                    model: 'llama-3.3-70b', // Venice medium
                    temperature: 0.05,       // Très faible pour plus de précision
                    max_tokens: 500
                }
            );

            // Nettoyer la réponse JSON
            let cleanJson = response
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();

            // Extraire JSON si encapsulé dans du texte
            const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanJson = jsonMatch[0];
            }

            const analysis = JSON.parse(cleanJson);

            // Log pour debug
            console.log('[ContextAgent] LLM Analysis:', {
                coherent: analysis.coherent,
                contextLoss: analysis.contextLoss,
                wrongConversation: analysis.wrongConversation,
                confidence: analysis.confidence,
                issue: analysis.issue
            });

            // Déclencher une alerte si problème détecté avec assez de confiance
            if ((analysis.contextLoss || analysis.wrongConversation || analysis.topicJump) &&
                analysis.confidence > 0.75) {

                const evidence: ContextEvidence = {
                    userAsked: userMessage,
                    aiAnswered: aiResponse,
                    contextMismatch: analysis.issue || analysis.explanation || 'Incohérence contextuelle détectée',
                    relevantHistory: history.slice(-3).map(h => h.content.substring(0, 100))
                };

                // Déterminer le type d'alerte
                let alertType: 'CONTEXT_LOSS' | 'TOPIC_JUMP' | 'WRONG_RECIPIENT' = 'CONTEXT_LOSS';
                if (analysis.wrongConversation) alertType = 'WRONG_RECIPIENT';
                else if (analysis.topicJump) alertType = 'TOPIC_JUMP';

                return {
                    agentId,
                    conversationId,
                    contactId,
                    agentType: 'CONTEXT',
                    alertType,
                    severity: analysis.severity || 'MEDIUM',
                    title: analysis.wrongConversation
                        ? '⚠️ L\'IA répond à une autre conversation'
                        : analysis.topicJump
                            ? 'Saut de sujet détecté'
                            : 'Perte de contexte détectée',
                    description: `[Confiance: ${Math.round(analysis.confidence * 100)}%] ${analysis.issue || analysis.explanation}.\n\nContact: "${userMessage.substring(0, 80)}${userMessage.length > 80 ? '...' : ''}"\nIA: "${aiResponse.substring(0, 80)}${aiResponse.length > 80 ? '...' : ''}"`,
                    evidence: evidence as Record<string, any>
                };
            }
        } catch (error) {
            console.error('[ContextAgent] LLM analysis failed:', error);
            if (response) {
                console.error('[ContextAgent] Raw response:', response);
            }
        }

        return null;
    }
};
