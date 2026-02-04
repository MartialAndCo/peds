import { SwarmState } from '../types';
import { prisma } from '@/lib/prisma';

export async function personaNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] personaNode: Chargement identité');
  
  const profile = await prisma.agentProfile.findUnique({
    where: { agentId: state.agentId }
  });
  
  if (!profile) {
    throw new Error(`AgentProfile not found for ${state.agentId}`);
  }
  
  const personaContext = `[QUI TU ES]:
${profile.identityTemplate || ''}

[TA SITUATION]:
${profile.contextTemplate || ''}

[TA MISSION]:
${profile.missionTemplate || ''}`;
  
  return {
    contexts: {
      ...state.contexts,
      persona: personaContext
    }
  };
}
