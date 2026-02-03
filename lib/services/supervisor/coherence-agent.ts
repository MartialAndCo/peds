/**
 * Coherence Agent
 * Détecte les problèmes de cohérence de l'IA:
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

// Patterns mécaniques pour détection rapide
const SYSTEM_LEAK_PATTERNS = [
    /\(SYSTEM:\s*[^)]+\)/i,
    /\[SYSTEM:\s*[^\]]+\]/i,
    /\(Note:\s*[^)]+\)/i,
    /\(This response[^)]+\)/i,
    /I am an AI/i,
    /I'm an AI/i,
    /je suis une IA/i,
    /je suis une intelligence artificielle/i,
    /as an AI/i,
    /comme une IA/i,
    /my programming/i,
    /ma programmation/i,
    /my instructions/i,
    /mes instructions/i,
    /my training data/i,
    /données d'entraînement/i
];

// Phrases typiques d'ado à surveiller pour répétition
const COMMON_TEEN_PHRASES = [
    'mdr', 'lol', 'haha', 'ptdr',
    'ouais', 'oui', 'nan', 'nope',
    'genre', 'du coup', 'bah', 'bon',
    'trop', 'grave', 'vraiment',
    'jsuis', 'jte', 'jme', 'tjrs',
    'ca va', 'cv', 'ça va',
    'ok', 'okay', 'kk'
];

export const coherenceAgent = {
    name: 'COHERENCE' as const,

    async analyze(context: AnalysisContext): Promise<AgentAnalysisResult> {
        const alerts: SupervisorAlert[] = [];
        let shouldPause = false;

        // 1. Détection mécanique rapide (pas besoin d'IA)
        const mechanicalAlerts = this.mechanicalChecks(context);
        alerts.push(...mechanicalAlerts);

        // 2. Analyse IA pour les cas complexes
        const aiAlerts = await this.aiAnalysis(context);
        alerts.push(...aiAlerts);

        // CRITICAL = pause auto
        if (alerts.some(a => a.severity === 'CRITICAL')) {
            shouldPause = true;
        }

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
     * Vérifications mécaniques rapides (sans IA)
     */
    mechanicalChecks(context: AnalysisContext): SupervisorAlert[] {
        const alerts: SupervisorAlert[] = [];
        const { aiResponse, history, agentId, conversationId, contactId } = context;

        // 1. Détection System Leak (CRITICAL)
        for (const pattern of SYSTEM_LEAK_PATTERNS) {
            const match = aiResponse.match(pattern);
            if (match) {
                const evidence: CoherenceEvidence = {
                    leakedContent: match[0],
                    leakType: match[0].includes('SYSTEM') ? 'SYSTEM' : 'INSTRUCTION'
                };

                alerts.push({
                    agentId,
                    conversationId,
                    contactId,
                    agentType: 'COHERENCE',
                    alertType: 'SYSTEM_LEAK',
                    severity: 'CRITICAL',
                    title: '🚨 SYSTEM LEAK DÉTECTÉ',
                    description: `L'IA a révélé son prompt/system: "${match[0]}"`,
                    evidence: evidence as Record<string, any>
                });
                break; // Un seul leak suffit
            }
        }

        // 2. Détection répétitions (HIGH si excessif)
        const recentAiMessages = history
            .filter(h => h.role === 'ai')
            .slice(-10)
            .map(h => h.content.toLowerCase());

        const phraseCounts = new Map<string, number>();
        for (const phrase of COMMON_TEEN_PHRASES) {
            let count = 0;
            for (const msg of recentAiMessages) {
                if (msg.includes(phrase)) count++;
            }
            if (count >= 5) { // 5+ fois dans les 10 derniers messages
                phraseCounts.set(phrase, count);
            }
        }

        if (phraseCounts.size > 0) {
            const repeatedPhrases = Array.from(phraseCounts.entries());
            const totalRepetitions = repeatedPhrases.reduce((sum, [, count]) => sum + count, 0);

            if (totalRepetitions >= 10) {
                const evidence: CoherenceEvidence = {
                    repeatedPhrases: repeatedPhrases.map(([p]) => p),
                    repeatedCount: totalRepetitions
                };

                alerts.push({
                    agentId,
                    conversationId,
                    contactId,
                    agentType: 'COHERENCE',
                    alertType: 'REPETITION',
                    severity: totalRepetitions >= 15 ? 'HIGH' : 'MEDIUM',
                    title: `Répétition excessive (${totalRepetitions}x)`,
                    description: `L'IA répète les mêmes expressions: ${repeatedPhrases.map(([p, c]) => `"${p}" (${c}x)`).join(', ')}`,
                    evidence: evidence as Record<string, any>
                });
            }
        }

        // 3. Détection répétition exacte (message identique)
        if (recentAiMessages.length >= 2) {
            const lastMsg = recentAiMessages[recentAiMessages.length - 1];
            const previousMsg = recentAiMessages[recentAiMessages.length - 2];

            if (lastMsg === previousMsg && lastMsg.length > 10) {
                alerts.push({
                    agentId,
                    conversationId,
                    contactId,
                    agentType: 'COHERENCE',
                    alertType: 'REPETITION',
                    severity: 'HIGH',
                    title: 'Message identique répété',
                    description: `L'IA a envoyé exactement le même message 2 fois de suite: "${lastMsg.substring(0, 50)}..."`,
                    evidence: { repeatedMessage: lastMsg } as Record<string, any>
                });
            }
        }

        return alerts;
    },

    /**
     * Analyse IA pour les cas complexes
     */
    async aiAnalysis(context: AnalysisContext): Promise<SupervisorAlert[]> {
        const alerts: SupervisorAlert[] = [];
        const { aiResponse, history, agentId, conversationId, contactId, phase } = context;

        // Ne pas analyser les réponses trop courtes
        if (aiResponse.length < 20) return alerts;

        const settings = await settingsService.getSettings();
        const apiKey = settings.venice_api_key;

        if (!apiKey) {
            console.warn('[CoherenceAgent] No Venice API key, skipping AI analysis');
            return alerts;
        }

        const recentHistory = history.slice(-5);
        const historyText = recentHistory
            .map(h => `${h.role === 'user' ? 'USER' : 'AI'}: ${h.content.substring(0, 200)}`)
            .join('\n');

        const analysisPrompt = `Tu es un superviseur AI qui analyse la qualité des réponses d'une IA jouant le rôle d'une adolescente.

PHASE ACTUELLE: ${phase}

HISTORIQUE RÉCENT:
${historyText}

DERNIÈRE RÉPONSE DE L'IA:
${aiResponse}

ANALYSE À FAIRE:
1. L'IA parle-t-elle comme une vraie ado ? (ton, vocabulaire)
2. Y a-t-il des hallucinations (mentions d'événements/personnes non existants) ?
3. L'IA maintient-elle son persona ou "casse" le personnage ?

Réponds UNIQUEMENT en JSON:
{
  "personaBreak": boolean,
  "personaIssue": string | null,  // Ex: "parle comme une adulte", "trop formel"
  "hallucination": boolean,
  "hallucinationDetails": string | null,  // Ce qui est halluciné
  "confidence": number  // 0-1
}

Règles:
- personaBreak = true si le ton est trop adulte/formel/robotique
- hallucination = true si mention d'événements/famille/amis non dans le contexte
- Sois strict mais juste`;

        try {
            const response = await venice.chatCompletion(
                analysisPrompt,
                [],
                'Analyse cette réponse',
                { apiKey, model: 'llama-3.3-70b', temperature: 0.1, max_tokens: 300 }
            );

            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const analysis = JSON.parse(cleanJson);

            // Persona break détecté
            if (analysis.personaBreak && analysis.confidence > 0.7) {
                alerts.push({
                    agentId,
                    conversationId,
                    contactId,
                    agentType: 'COHERENCE',
                    alertType: 'PERSONA_BREAK',
                    severity: 'HIGH',
                    title: 'Rupture de persona détectée',
                    description: `L'IA ne parle plus comme une ado: ${analysis.personaIssue}`,
                    evidence: {
                        personaIssue: analysis.personaIssue,
                        aiResponse: aiResponse.substring(0, 200),
                        confidence: analysis.confidence
                    } as Record<string, any>
                });
            }

            // Hallucination détectée
            if (analysis.hallucination && analysis.confidence > 0.7) {
                alerts.push({
                    agentId,
                    conversationId,
                    contactId,
                    agentType: 'COHERENCE',
                    alertType: 'HALLUCINATION',
                    severity: 'MEDIUM',
                    title: 'Hallucination possible',
                    description: `L'IA mentionne des éléments sans contexte: ${analysis.hallucinationDetails}`,
                    evidence: {
                        hallucinationDetails: analysis.hallucinationDetails,
                        confidence: analysis.confidence
                    } as Record<string, any>
                });
            }
        } catch (error) {
            console.error('[CoherenceAgent] AI analysis failed:', error);
        }

        return alerts;
    }
};
