import { SwarmState } from '../types';
import { prisma } from '@/lib/prisma';
import { settingsService } from '@/lib/settings-cache';

export async function voiceNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] voiceNode: Analyse contexte vocal');
  
  const profile = await prisma.agentProfile.findUnique({
    where: { agentId: state.agentId },
    select: { locale: true }
  });
  
  const isFrench = (profile?.locale || '').toLowerCase().startsWith('fr');
  
  // Vérifier si vocaux activés
  const settings = await settingsService.getSettings();
  const voiceEnabled = settings['voice_response_enabled'] === 'true' || settings['voice_response_enabled'] === true;
  
  // Détecter si message reçu est un vocal
  const isVoiceReceived = state.lastMessageType === 'voice' || state.lastMessageType === 'ptt' || state.lastMessageType === 'audio';
  
  // Détecter accusation de fake
  const msg = state.userMessage.toLowerCase();
  const isAccused = msg.includes('fake') || msg.includes('bot') || msg.includes('robot') || msg.includes('ia') || msg.includes('ai') || msg.includes('not real');
  
  let voiceContext: string;
  
  if (voiceEnabled) {
    voiceContext = isFrench ? `[VOCAUX - CAPACITÉ ACTIVÉE]:
- Tu PEUX envoyer des vocaux (tag [VOICE])
- OBLIGATOIRE si: 1) Il t'envoie un vocal → réponds par vocal | 2) Il t'accuse de fake → envoie vocal pour prouver
- Tu PRÉFÈRES écrire (ne propose jamais vocal toi-même)
- Refus naturel: "j'préfère écrire" / "chui pas à l'aise"

SITUATION ACTUELLE:
${isVoiceReceived ? '- Il vient de t\'envoyer un VOCAL → TU DOIS RÉPONDRE PAR VOCAL [VOICE]' : ''}
${isAccused ? '- Il t\'accuse de fake/bot → TU DOIS ENVOYER UN VOCAL [VOICE]' : ''}` 
    : `[VOICE - ENABLED]:
- You CAN send voice messages (tag [VOICE])
- REQUIRED if: 1) User sends voice → reply with voice | 2) Accused of fake → send voice to prove
- You PREFER texting (never suggest voice yourself)
- Natural refusal: "prefer texting" / "not comfortable"

CURRENT SITUATION:
${isVoiceReceived ? '- User just sent VOICE → YOU MUST REPLY WITH VOICE [VOICE]' : ''}
${isAccused ? '- User accused you of fake/bot → YOU MUST SEND VOICE [VOICE]' : ''}`;
  } else {
    voiceContext = isFrench 
      ? `[VOCAUX - DÉSACTIVÉS]:
- Tu n'envoies PAS de vocaux
- Refus NATUREL (pas d'excuses techniques): "j'aime pas les vocaux" / "chui pas à l'aise"
- Ne promets JAMAIS pour plus tard`
      : `[VOICE - DISABLED]:
- You do NOT send voice messages
- Natural refusal (no technical excuses): "don't like voice" / "not comfortable"
- NEVER promise for later`;
  }
  
  return {
    contexts: {
      ...state.contexts,
      voice: voiceContext
    },
    shouldSendVoice: voiceEnabled && (isVoiceReceived || isAccused)
  };
}
