import { SwarmState } from '../types';
import { prisma } from '@/lib/prisma';
import { AgentPhase } from '@/lib/director';

export async function phaseNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] phaseNode: Analyse phase relation');
  
  const agentContact = await prisma.agentContact.findUnique({
    where: {
      agentId_contactId: {
        agentId: state.agentId,
        contactId: state.contactId
      }
    }
  });
  
  const phase = (agentContact?.phase || 'CONNECTION') as AgentPhase;
  const signals = (agentContact?.signals || []) as string[];
  
  const profile = await prisma.agentProfile.findUnique({
    where: { agentId: state.agentId },
    select: {
      phaseConnectionTemplate: true,
      phaseVulnerabilityTemplate: true,
      phaseCrisisTemplate: true,
      phaseMoneypotTemplate: true,
      locale: true
    }
  });
  
  const isFrench = (profile?.locale || '').toLowerCase().startsWith('fr');
  
  // Sélection du template de phase
  let phaseTemplate = '';
  switch (phase) {
    case 'CONNECTION':
      phaseTemplate = profile?.phaseConnectionTemplate || (isFrench 
        ? 'OBJECTIF: Créer une connexion naturelle et légère.'
        : 'OBJECTIVE: Create natural, friendly connection.');
      break;
    case 'VULNERABILITY':
      phaseTemplate = profile?.phaseVulnerabilityTemplate || (isFrench
        ? 'OBJECTIF: Partager des problèmes personnels pour créer du lien.'
        : 'GOAL: Share personal problems to build emotional connection.');
      break;
    case 'CRISIS':
      phaseTemplate = profile?.phaseCrisisTemplate || (isFrench
        ? 'OBJECTIF: Tu es en galère financière. Il veut t\'aider. Accepte avec hésitation naturelle.'
        : 'GOAL: You\'re in a financial crisis. He wants to help. Accept with natural hesitation.');
      break;
    case 'MONEYPOT':
      phaseTemplate = profile?.phaseMoneypotTemplate || (isFrench
        ? 'OBJECTIF: Relation établie. Tu veux te faire plaisir.'
        : 'GOAL: Romantic relationship established. You have feelings.');
      break;
  }
  
  // Description des signaux
  const signalDescriptions = signals.map(s => {
    switch (s) {
      case 'RESPONSIVE': return isFrench ? 'Réactif' : 'Responsive';
      case 'INTERESTED': return isFrench ? 'Intéressé' : 'Interested';
      case 'ATTACHED': return isFrench ? 'Accro' : 'Attached';
      case 'DEFENSIVE': return isFrench ? 'Sur la défensive' : 'Defensive';
      case 'GENEROUS': return isFrench ? 'Généreux' : 'Generous';
      default: return s;
    }
  });
  
  const phaseContext = `[PHASE ACTUELLE: ${phase}]:\n${phaseTemplate}\n\nSignaux détectés: ${signalDescriptions.join(', ') || (isFrench ? 'Aucun encore' : 'None yet')}\nÉtat relation: ${describePhase(phase, signals, isFrench)}`;
  
  return {
    contexts: {
      ...state.contexts,
      phase: phaseContext
    },
    currentPhase: phase
  };
}

function describePhase(phase: AgentPhase, signals: string[], isFrench: boolean): string {
  const hasAttached = signals.includes('ATTACHED');
  const hasGenerous = signals.includes('GENEROUS');
  const hasResponsive = signals.includes('RESPONSIVE');
  
  if (isFrench) {
    if (phase === 'MONEYPOT' && hasAttached) return 'Relation très proche, prêt à aider';
    if (phase === 'CRISIS' && hasGenerous) return 'En galère mais il veut aider';
    if (phase === 'VULNERABILITY' && hasAttached) return 'Accro émotionnellement';
    if (hasResponsive) return 'Réceptif, continue sur cette lancée';
    return 'En cours de construction';
  } else {
    if (phase === 'MONEYPOT' && hasAttached) return 'Very close relationship, ready to help';
    if (phase === 'CRISIS' && hasGenerous) return 'In trouble but he wants to help';
    if (phase === 'VULNERABILITY' && hasAttached) return 'Emotionally attached';
    if (hasResponsive) return 'Responsive, keep going';
    return 'Building connection';
  }
}
