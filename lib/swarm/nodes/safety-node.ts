// Agent "Safety" - Injecte les safetyRules depuis la base de données
import type { SwarmState } from '../types';

export async function safetyNode(state: SwarmState): Promise<Partial<SwarmState>> {
  const { profile, platform } = state;

  console.log('[Swarm][Safety] Loading safetyRules from DB...');

  const safetyRules = profile?.safetyRules;

  if (!safetyRules || safetyRules.trim().length === 0) {
    console.log('[Swarm][Safety] No safetyRules in DB');
    return { contexts: { ...state.contexts, safety: '' } };
  }

  // Déterminer le nom de la plateforme
  const platformName = platform === 'discord' ? 'Discord' : 'WhatsApp';
  
  // Remplacer {{PLATFORM}} par le vrai nom
  const processedRules = safetyRules.replace(/\{\{PLATFORM\}\}/g, platformName);

  // Injecter depuis la base
  const safetyBlock = `🛡️ SAFETY RULES (DEPUIS DB):
${processedRules}`;

  console.log('[Swarm][Safety] Loaded from DB (platform: ' + platformName + ')');

  return {
    contexts: {
      ...state.contexts,
      safety: safetyBlock
    }
  };
}
