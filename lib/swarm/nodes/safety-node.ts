// Agent "Safety" - Injecte les safetyRules depuis la base de données
import type { SwarmState } from '../types';

export async function safetyNode(state: SwarmState): Promise<Partial<SwarmState>> {
  const { profile } = state;

  console.log('[Swarm][Safety] Loading safetyRules from DB...');

  const safetyRules = profile?.safetyRules;

  if (!safetyRules || safetyRules.trim().length === 0) {
    console.log('[Swarm][Safety] No safetyRules in DB');
    return { contexts: { ...state.contexts, safety: '' } };
  }

  // Injecter tel quel depuis la base
  const safetyBlock = `🛡️ SAFETY RULES (DEPUIS DB):
${safetyRules}`;

  console.log('[Swarm][Safety] Loaded from DB');

  return {
    contexts: {
      ...state.contexts,
      safety: safetyBlock
    }
  };
}
