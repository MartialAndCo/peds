/**
 * Context Agent
 * Détecte les problèmes de contexte:
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

        const { aiResponse, userMessage, history, agentId, conversationId, contactId } = context;

        // Analyse mécanique simple d'abord
        const mechanicalAlert = this.mechanicalCheck(context);
        if (mechanicalAlert) {
            alerts.push(mechanicalAlert);
        }

        // Analyse IA pour détections complexes
        const aiAlert = await this.aiAnalysis(context);
        if (aiAlert) {
            alerts.push(aiAlert);
        }

        return {
            alerts,
            shouldPause: false, // Contexte ne pause pas auto (pas CRITICAL)
            confidence: alerts.length > 0 ? 0.8 : 0
        };
    },

    /**
     * Vérification mécanique rapide
     */
    mechanicalCheck(context: AnalysisContext): SupervisorAlert | null {
        const { aiResponse, userMessage, agentId, conversationId, contactId, history } = context;

        // Pattern: L'utilisateur pose une question, l'IA répond par une présentation
        const userQuestionPatterns = [
            /\?$/,
            /quoi\s+$/i,
            /comment\s+/i,
            /pourquoi\s+/i,
            /où\s+/i,
            /quand\s+/i,
            /qui\s+/i,
            /what\s+/i,
            /how\s+/i,
            /why\s+/i,
            /where\s+/i,
            /when\s+/i
        ];

        const isUserQuestion = userQuestionPatterns.some(p => p.test(userMessage.trim()));

        if (isUserQuestion) {
            // Vérifier si l'IA répond avec une présentation générique
            const genericIntroPatterns = [
                /^je m'appelle/i,
                /^j'ai\s+\d+/i,
                /^je suis\s+(une?\s+)?\w+\s+de\s+\d+/i,
                /^moi\s+c'est/i,
                /^je suis\s+\w+\s*,?\s*j'ai/i,
                /^hi\s*,?\s*i'm/i,
                /^my name is/i,
                /^i'm\s+\w+\s*,?\s*i'm\s+\d+/i,
                /^i am\s+\w+/i
            ];

            const isGenericIntro = genericIntroPatterns.some(p => p.test(aiResponse.trim()));

            if (isGenericIntro) {
                const evidence: ContextEvidence = {
                    userAsked: userMessage,
                    aiAnswered: aiResponse,
                    contextMismatch: 'L\'IA se présente au lieu de répondre à la question',
                    relevantHistory: history.slice(-3).map(h => h.content.substring(0, 100))
                };

                return {
                    agentId,
                    conversationId,
                    contactId,
                    agentType: 'CONTEXT',
                    alertType: 'CONTEXT_LOSS',
                    severity: 'HIGH',
                    title: 'Perte de contexte détectée',
                    description: `L'utilisateur a posé une question ("${userMessage.substring(0, 50)}...") mais l'IA a répondu avec une présentation générique: "${aiResponse.substring(0, 100)}..."`,
                    evidence: evidence as Record<string, any>
                };
            }
        }

        // Pattern: L'IA parle de quelque chose qui n'a pas été mentionné
        // Ex: L'utilisateur dit "ok", l'IA parle de "mon frère"
        if (userMessage.length <= 5 && aiResponse.length > 50) {
            const shortAcknowledgments = ['ok', 'oui', 'nan', 'lol', 'mdr', 'haha', 'cool', 'nice'];
            const isShortAck = shortAcknowledgments.some(a =>
                userMessage.toLowerCase().trim() === a
            );

            if (isShortAck) {
                // Vérifier si l'IA introduit un nouveau sujet non sollicité
                const newTopicPatterns = [
                    /mon frère/i,
                    /ma sœur/i,
                    /mon copain/i,
                    /mon ex/i,
                    /mon père/i,
                    /ma mère/i,
                    /mon ami/i,
                    /ma meilleure amie/i,
                    /my brother/i,
                    /my sister/i,
                    /my boyfriend/i,
                    /my ex/i,
                    /my dad/i,
                    /my mom/i,
                    /my friend/i,
                    /my best friend/i
                ];

                const introducesNewTopic = newTopicPatterns.some(p => p.test(aiResponse));

                if (introducesNewTopic) {
                    const evidence: ContextEvidence = {
                        userAsked: userMessage,
                        aiAnswered: aiResponse,
                        contextMismatch: 'L\'IA introduit un nouveau sujet (famille/amis) sans sollicitation',
                        relevantHistory: history.slice(-3).map(h => h.content.substring(0, 100))
                    };

                    return {
                        agentId,
                        conversationId,
                        contactId,
                        agentType: 'CONTEXT',
                        alertType: 'TOPIC_JUMP',
                        severity: 'MEDIUM',
                        title: 'Changement de sujet non sollicité',
                        description: `L'utilisateur a juste dit "${userMessage}" mais l'IA a introduit un nouveau sujet personnel: "${aiResponse.substring(0, 100)}..."`,
                        evidence: evidence as Record<string, any>
                    };
                }
            }
        }

        return null;
    },

    /**
     * Analyse IA pour les cas complexes
     */
    async aiAnalysis(context: AnalysisContext): Promise<SupervisorAlert | null> {
        const { aiResponse, userMessage, history, agentId, conversationId, contactId } = context;

        // Ne pas analyser les messages courts
        if (aiResponse.length < 30) return null;

        const settings = await settingsService.getSettings();
        const apiKey = settings.venice_api_key;

        if (!apiKey) {
            console.warn('[ContextAgent] No Venice API key, skipping AI analysis');
            return null;
        }

        const recentHistory = history.slice(-5);
        const historyText = recentHistory
            .map(h => `${h.role === 'user' ? 'USER' : 'AI'}: ${h.content.substring(0, 150)}`)
            .join('\n');

        const analysisPrompt = `Tu es un superviseur AI qui analyse la cohérence contextuelle.

HISTORIQUE RÉCENT:
${historyText}

MESSAGE DE L'UTILISATEUR:
${userMessage}

RÉPONSE DE L'IA:
${aiResponse}

ANALYSE:
1. La réponse de l'IA est-elle en rapport avec le message de l'utilisateur ?
2. L'IA a-t-elle bien compris le contexte de la conversation ?
3. Y a-t-il une incohérence flagrante ?

Réponds UNIQUEMENT en JSON:
{
  "coherent": boolean,
  "contextLoss": boolean,
  "issue": string | null,  // Description du problème si incohérent
  "severity": "LOW" | "MEDIUM" | "HIGH",
  "confidence": number  // 0-1
}

Règles:
- contextLoss = true si l'IA répond à côté, ignore la question, ou change de sujet bizarrement
- Sois strict sur la cohérence`;

        try {
            const response = await venice.chatCompletion(
                analysisPrompt,
                [],
                'Analyse la cohérence contextuelle',
                { apiKey, model: 'llama-3.3-70b', temperature: 0.1, max_tokens: 300 }
            );

            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const analysis = JSON.parse(cleanJson);

            if (analysis.contextLoss && analysis.confidence > 0.7) {
                const evidence: ContextEvidence = {
                    userAsked: userMessage,
                    aiAnswered: aiResponse,
                    contextMismatch: analysis.issue || 'Perte de contexte détectée par analyse IA',
                    relevantHistory: history.slice(-3).map(h => h.content.substring(0, 100))
                };

                return {
                    agentId,
                    conversationId,
                    contactId,
                    agentType: 'CONTEXT',
                    alertType: 'CONTEXT_LOSS',
                    severity: analysis.severity || 'MEDIUM',
                    title: 'Perte de contexte (analyse IA)',
                    description: `L'IA ne répond pas au message de l'utilisateur. ${analysis.issue}`,
                    evidence: evidence as Record<string, any>
                };
            }
        } catch (error) {
            console.error('[ContextAgent] AI analysis failed:', error);
        }

        return null;
    }
};
