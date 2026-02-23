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

// ── Photo demand detection ──
// Phrase-based: always valid demand signals (multi-word, unambiguous)
const PHOTO_DEMAND_PHRASES = [
    'envoie une photo', 'envoie moi', 'envoie-moi', 'montre-moi', 'montre toi',
    'fais voir', 'send me a pic', 'send a pic', 'send me a photo', 'show me',
    'let me see', 'photo de toi', 'picture of you', 'jveux voir',
    'je veux voir', 'tu peux montrer', 'see your face',
    'show yourself', 'send photo', 'your photo', 'ton visage', 'ta tête',
    'une photo de toi', 'pic of you'
];

// Single keywords that are always unambiguous demands
const PHOTO_UNAMBIGUOUS_KEYWORDS = ['selfie'];

// False positive patterns: user talking ABOUT photos, not requesting
const PHOTO_FALSE_POSITIVE_PATTERNS = [
    /j'ai.*photo/i,
    /j'ai envoyé.*photo/i,
    /une photo de (mon|ma|mes|son|sa|ses)/i,
    /photo de (mon|ma|mes)/i,
    /photo de profil/i,
    /j'ai pris.*photo/i,
    /belle(s)? photo/i,
    /bonne photo/i,
    /sur (la|une|cette) photo/i,
    /c'est (une|la) photo/i,
    /j'aime (la|ta|cette) photo/i,
    /j'ai vu.*photo/i,
    /ma photo/i,
    /mes photos/i,
    /la photo (de|du|des)/i,
    /i (took|have|had|saw|like|love).*photo/i,
    /nice (photo|pic|picture)/i,
    /great (photo|pic|picture)/i,
    /good (photo|pic|picture)/i,
];

function isUserRequestingPhoto(userMessage: string): boolean {
    const msg = userMessage.toLowerCase();

    // Check false positives first
    if (PHOTO_FALSE_POSITIVE_PATTERNS.some(p => p.test(msg))) {
        return false;
    }

    // Check unambiguous single keywords
    if (PHOTO_UNAMBIGUOUS_KEYWORDS.some(kw => msg.includes(kw))) {
        return true;
    }

    // Check multi-word demand phrases
    if (PHOTO_DEMAND_PHRASES.some(phrase => msg.includes(phrase))) {
        return true;
    }

    return false;
}

// Mots-clés qui indiquent une demande de vocal
const VOICE_REQUEST_KEYWORDS = [
    'vocal', 'vocaux', 'voice', 'audio', 'message vocal',
    'envoie un vocal', 'parle moi', 'dis le moi',
    'send voice', 'voice message', 'record'
];

export const actionAgent = {
    name: 'ACTION' as const,

    async analyze(context: AnalysisContext): Promise<AgentAnalysisResult> {
        const alerts: SupervisorAlert[] = [];
        let shouldPause = false;

        const { aiResponse, userMessage, phase, agentId, conversationId, contactId } = context;

        // 1. Détection IMAGE tag
        const imageTagMatch = aiResponse.match(/\[IMAGE:(.+?)\]/);
        if (imageTagMatch) {
            const imageType = imageTagMatch[1].trim();
            const alert = this.checkImageTag(
                imageType,
                userMessage,
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
                const userAskedPhoto = isUserRequestingPhoto(userMessage);

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
        userMessage: string,
        phase: string,
        aiResponse: string,
        agentId: string,
        conversationId: number,
        contactId?: string | null
    ): SupervisorAlert | null {
        // Vérifier si l'utilisateur a explicitement demandé une photo
        const userAskedPhoto = isUserRequestingPhoto(userMessage);

        // Vérifier les faux positifs (l'utilisateur parle D'UNE photo, pas DEMANDE une photo)
        const isFalsePositive = PHOTO_FALSE_POSITIVE_PATTERNS.some(p => p.test(userMessage));

        if (!userAskedPhoto || isFalsePositive) {
            const evidence: ActionEvidence = {
                action: 'USED_IMAGE_TAG',
                triggerMessage: userMessage,
                shouldHaveTriggered: false,
                aiResponse: aiResponse.substring(0, 200),
                detectedKeywords: [],
                currentPhase: phase
            };

            return {
                agentId,
                conversationId,
                contactId,
                agentType: 'ACTION',
                alertType: 'UNREQUESTED_IMAGE_TAG',
                severity: 'CRITICAL',
                title: '🚨 [IMAGE] utilisé SANS DEMANDE EXPLICITE',
                description: `L'IA a utilisé [IMAGE:${imageType}] alors que l'utilisateur n'a pas explicitement demandé de photo. Message: "${userMessage.substring(0, 100)}"`,
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
            const userAskedPhoto = isUserRequestingPhoto(triggerMessage);

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
