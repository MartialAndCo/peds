import { SwarmState } from '../types';
import { personaSchedule } from '@/lib/services/persona-schedule';

export async function timingNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] timingNode: Calcul contexte temps');
  
  // Utiliser le profile déjà récupéré dans index.ts
  const timezone = state.profile?.timezone || 'Europe/Paris';
  const locale = (state.profile?.locale || 'fr-FR').toLowerCase();
  
  const timingContext = personaSchedule.getContextPrompt(timezone, undefined, locale);
  
  return {
    contexts: {
      ...state.contexts,
      timing: timingContext
    }
  };
}
