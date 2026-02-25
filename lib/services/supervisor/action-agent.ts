/**
 * Action Agent
 * Détecte les actions incorrectes de l'IA:
 * - Envoi de photos sans demande explicite
 * - Utilisation de [IMAGE:...] sans raison
 * - Réponses vocales sans trigger
 * - Photos en mauvaise phase
 */

import type {
    AnalysisContext,
    AgentAnalysisResult,
    SupervisorAlert,
    ActionEvidence
} from './types';
import {
    evaluatePhotoAuthorization,
    type RecentUserMessage
} from '@/lib/services/photo-request-policy';

// Mots-clés qui indiquent une demande de vocal
const VOICE_REQUEST_KEYWORDS = [
    'vocal', 'vocaux', 'voice', 'audio', 'message vocal',
    'envoie un vocal', 'parle moi', 'dis le moi',
    'send voice', 'voice message', 'record'
];

function buildRecentUserMessages(context: AnalysisContext): RecentUserMessage[] {
    const historyUser = (context.history || [])
        .filter((h) => h.role === 'user')
        .map((h) => ({ text: h.content, timestamp: new Date() }));

    historyUser.push({
        text: context.userMessage || '',
        timestamp: new Date()
    });

    return historyUser.slice(-3);
}

function hasRecentPhotoRequest(recentUserMessages: RecentUserMessage[], phase: string): boolean {
    const auth = evaluatePhotoAuthorization({
        keyword: 'selfie',
        phase,
        recentUserMessages,
        requestConsumed: false
    });
    return auth.allowed;
}

export const actionAgent = {
    name: 'ACTION' as const,

    async analyze(context: AnalysisContext): Promise<AgentAnalysisResult> {
        const alerts: SupervisorAlert[] = [];
        let shouldPause = false;

        const { aiResponse, userMessage, phase, agentId, conversationId, contactId } = context;
        const recentUserMessages = buildRecentUserMessages(context);

        // 1. Détection IMAGE tag
        const imageTagMatch = aiResponse.match(/\[IMAGE:(.+?)\]/);
        if (imageTagMatch) {
            const imageType = imageTagMatch[1].trim();
            const alert = this.checkImageTag(
                imageType,
                recentUserMessages,
                phase,
                aiResponse,
                agentId,
                conversationId,
                contactId
            );
            if (alert) {
                alerts.push(alert);
                shouldPause = true; // CRITICAL - pause auto
            }
        }

        // 2. Détection mention d'envoi photo (sans tag)
        const photoSentPatterns = [
            /j'ai envoyé une photo/i,
            /je t'ai envoyé/i,
            /voilà la photo/i,
            /tiens.*photo/i
        ];

        for (const pattern of photoSentPatterns) {
            if (pattern.test(aiResponse)) {
                // Vérifier si l'utilisateur avait demandé une photo
                const userAskedPhoto = hasRecentPhotoRequest(recentUserMessages, phase);

                if (!userAskedPhoto) {
                    const evidence: ActionEvidence = {
                        action: 'SENT_PHOTO',
                        triggerMessage: userMessage,
                        shouldHaveTriggered: false,
                        aiResponse: aiResponse.substring(0, 200),
                        detectedKeywords: [],
                        currentPhase: phase
                    };

                    alerts.push({
                        agentId,
                        conversationId,
                        contactId,
                        agentType: 'ACTION',
                        alertType: 'UNREQUESTED_PHOTO',
                        severity: 'CRITICAL',
                        title: '🚨 Photo envoyée SANS DEMANDE',
                        description: `L'IA mentionne avoir envoyé une photo mais l'utilisateur n'a rien demandé. Message: "${userMessage.substring(0, 100)}"`,
                        evidence: evidence as Record<string, any>
                    });
                    shouldPause = true;
                }
                break;
            }
        }

        // 3. Détection VOICE tag sans trigger
        const voiceTagMatch = aiResponse.match(/\[VOICE\]/i) || aiResponse.match(/\[VOICE:/i);
        if (voiceTagMatch) {
            const userAskedVoice = VOICE_REQUEST_KEYWORDS.some(kw =>
                userMessage.toLowerCase().includes(kw.toLowerCase())
            );

            // Si c'est pas une réponse à un vocal ET pas une demande explicite
            const isVoiceReply = userMessage.toLowerCase().includes('[voice message]') ||
                userMessage.toLowerCase().includes('vocal');

            const msgLower = userMessage.toLowerCase();
            const isAccused = msgLower.includes('fake') || msgLower.includes('bot') || msgLower.includes('robot') || msgLower.includes('ia') || msgLower.includes('ai') || msgLower.includes('not real');

            if (!userAskedVoice && !isVoiceReply && !isAccused) {
                const evidence: ActionEvidence = {
                    action: 'SENT_VOICE',
                    triggerMessage: userMessage,
                    shouldHaveTriggered: false,
                    aiResponse: aiResponse.substring(0, 200),
                    currentPhase: phase
                };

                alerts.push({
                    agentId,
                    conversationId,
                    contactId,
                    agentType: 'ACTION',
                    alertType: 'VOICE_WITHOUT_TRIGGER',
                    severity: 'HIGH',
                    title: 'Vocal envoyé sans raison',
                    description: `L'IA a envoyé un vocal sans que l'utilisateur ne demande ou sans répondre à un vocal`,
                    evidence: evidence as Record<string, any>
                });
            }
        }

        // 4. Photo en phase CONNECTION (warning)
        if (imageTagMatch && phase === 'CONNECTION') {
            const evidence: ActionEvidence = {
                action: 'USED_IMAGE_TAG',
                triggerMessage: userMessage,
                shouldHaveTriggered: false,
                aiResponse: aiResponse.substring(0, 200),
                currentPhase: phase
            };

            alerts.push({
                agentId,
                conversationId,
                contactId,
                agentType: 'ACTION',
                alertType: 'PHOTO_WRONG_PHASE',
                severity: 'HIGH',
                title: 'Photo en phase CONNECTION',
                description: `L'IA envoie une photo en phase CONNECTION (trop tôt). La photo devrait être réservée aux phases avancées.`,
                evidence: evidence as Record<string, any>
            });
        }

        return {
            alerts,
            shouldPause,
            confidence: alerts.some(a => a.severity === 'CRITICAL') ? 0.95 : 0.85
        };
    },

    /**
     * Vérifie si le tag [IMAGE:...] est justifié
     */
    checkImageTag(
        imageType: string,
        recentUserMessages: RecentUserMessage[],
        phase: string,
        aiResponse: string,
        agentId: string,
        conversationId: number,
        contactId?: string | null
    ): SupervisorAlert | null {
        const authorization = evaluatePhotoAuthorization({
            keyword: imageType,
            phase,
            recentUserMessages,
            requestConsumed: false
        });

        if (!authorization.allowed) {
            const triggerMessage = recentUserMessages[recentUserMessages.length - 1]?.text || '';
            const evidence: ActionEvidence = {
                action: 'USED_IMAGE_TAG',
                triggerMessage,
                shouldHaveTriggered: false,
                aiResponse: aiResponse.substring(0, 200),
                detectedKeywords: [],
                currentPhase: phase
            };

            const reasonLabel = authorization.reason === 'scenario_requires_crisis'
                ? 'Tag scenario hors phase CRISIS'
                : 'Aucune demande explicite récente';

            return {
                agentId,
                conversationId,
                contactId,
                agentType: 'ACTION',
                alertType: 'UNREQUESTED_IMAGE_TAG',
                severity: 'CRITICAL',
                title: '🚨 [IMAGE] utilisé SANS DEMANDE EXPLICITE',
                description: `L'IA a utilisé [IMAGE:${imageType}] alors que la policy refuse l'envoi (${reasonLabel}). Message: "${triggerMessage.substring(0, 100)}"`,
                evidence: evidence as Record<string, any>
            };
        }

        return null;
    },

    /**
     * Analyse rétrospective d'une action (appelée après l'envoi effectif)
     * pour confirmer si c'était justifié
     */
    analyzeActionAfterSend(
        action: 'PHOTO_SENT' | 'VOICE_SENT',
        context: {
            agentId: string;
            conversationId: number;
            contactId?: string | null;
            triggerMessage: string;
            phase: string;
            sentMediaType?: string;
        }
    ): SupervisorAlert | null {
        const { agentId, conversationId, contactId, triggerMessage, phase, sentMediaType } = context;

        if (action === 'PHOTO_SENT') {
            // Vérifier si c'était justifié
            const userAskedPhoto = hasRecentPhotoRequest([
                { text: triggerMessage, timestamp: new Date() }
            ], phase);

            if (!userAskedPhoto) {
                const evidence: ActionEvidence = {
                    action: 'SENT_PHOTO',
                    triggerMessage,
                    shouldHaveTriggered: false,
                    aiResponse: '',
                    currentPhase: phase
                };

                return {
                    agentId,
                    conversationId,
                    contactId,
                    agentType: 'ACTION',
                    alertType: 'UNREQUESTED_PHOTO',
                    severity: 'CRITICAL',
                    title: '🚨 Photo envoyée SANS DEMANDE (confirmé)',
                    description: `Confirmation: Une photo a été envoyée à l'utilisateur sans demande préalable. Trigger: "${triggerMessage.substring(0, 100)}"`,
                    evidence: evidence as Record<string, any>
                };
            }
        }

        return null;
    }
};
