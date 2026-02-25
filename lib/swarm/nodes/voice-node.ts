import { SwarmState } from '../types';

export async function voiceNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] voiceNode: Analyse contexte vocal');

  // Utiliser le profile déjà récupéré dans index.ts
  const profile = state.profile;
  const isFrench = (profile?.locale || '').toLowerCase().startsWith('fr');

  // Use settings already loaded in swarm state to avoid extra DB roundtrip.
  const voiceEnabled = state.settings.voice_response_enabled === true;

  console.log(`[Swarm][Voice] Agent ${state.agentId}: voiceEnabled=${voiceEnabled}`)

  // Détecter si message reçu est un vocal
  const isVoiceReceived = state.lastMessageType === 'voice' || state.lastMessageType === 'ptt' || state.lastMessageType === 'audio';

  // Détecter accusation de fake
  const msg = state.userMessage.toLowerCase();
  const isAccused = msg.includes('fake') || msg.includes('bot') || msg.includes('robot') || msg.includes('ia') || msg.includes('ai') || msg.includes('not real');

  let voiceContext: string;

  if (voiceEnabled) {
    voiceContext = isFrench ? `[VOCAUX - CAPACITÉ ACTIVÉE]:
- Tu PEUX envoyer des vocaux (tag [VOICE] au début de ta phrase)
- HAUTEMENT STRICT: Le format est "[VOICE] ton texte très court", JAMAIS "[VOICE:I'm Lena...]". Ne mets JAMAIS ta description dans le tag.
- OBLIGATOIRE si: 1) Il t'envoie un vocal → réponds par vocal | 2) Il t'accuse de fake → envoie vocal hyper court pour prouver genre "[VOICE] mdr t'inquiète je suis vraie"
- Tu PRÉFÈRES écrire (ne propose jamais vocal toi-même)
- Refus naturel: "j'préfère écrire" / "chui pas à l'aise"

SITUATION ACTUELLE:
${isVoiceReceived ? '- Il vient de t\'envoyer un VOCAL → TU DOIS RÉPONDRE PAR VOCAL (ex: "[VOICE] texte court")' : ''}
${isAccused ? '- Il t\'accuse de fake/bot → TU DOIS ENVOYER UN VOCAL COURT POUR PROUVER, NE RACONTE PAS TA VIE (ex: "[VOICE] haha grave pas...").' : ''}`
      : `[VOICE - ENABLED]:
- You CAN send voice messages (tag [VOICE] at the beginning)
- HIGHLY STRICT: Format is "[VOICE] your short text", NEVER "[VOICE:I'm Lena...]". NEVER put your persona description in the tag.
- REQUIRED if: 1) User sends voice → reply with voice | 2) Accused of fake → send super short voice to prove like "[VOICE] lol no I'm real"
- You PREFER texting (never suggest voice yourself)
- Natural refusal: "prefer texting" / "not comfortable"

CURRENT SITUATION:
${isVoiceReceived ? '- User just sent VOICE → YOU MUST REPLY WITH VOICE (e.g. "[VOICE] short text")' : ''}
${isAccused ? '- User accused you of fake/bot → YOU MUST SEND A SHORT VOICE TO PROVE IT, DO NOT DUMP YOUR LIFE STORY (ex: "[VOICE] haha no way...").' : ''}`;
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
