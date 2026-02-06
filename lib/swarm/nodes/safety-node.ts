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

  // Déterminer le nom de la plateforme et l'âge
  const platformName = platform === 'discord' ? 'Discord' : 'WhatsApp';
  const agentAge = profile?.baseAge || 15;
  
  // Remplacer {{PLATFORM}} et {{AGE}} par les vraies valeurs
  const processedRules = safetyRules
    .replace(/\{\{PLATFORM\}\}/g, platformName)
    .replace(/\{\{AGE\}\}/g, agentAge.toString());

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
