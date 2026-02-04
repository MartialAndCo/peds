import { SwarmState } from '../types';
import { personaSchedule } from '@/lib/services/persona-schedule';
import { prisma } from '@/lib/prisma';

export async function timingNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] timingNode: Calcul contexte temps');
  
  const profile = await prisma.agentProfile.findUnique({
    where: { agentId: state.agentId },
    select: { timezone: true, locale: true }
  });
  
  const timezone = profile?.timezone || 'Europe/Paris';
  const locale = (profile?.locale || 'fr-FR').toLowerCase();
  
  const timingContext = personaSchedule.getContextPrompt(timezone, undefined, locale);
  
  return {
    contexts: {
      ...state.contexts,
      timing: timingContext
    }
  };
}
