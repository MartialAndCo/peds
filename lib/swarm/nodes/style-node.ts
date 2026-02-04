import { SwarmState } from '../types';
import { prisma } from '@/lib/prisma';

export async function styleNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] styleNode: Chargement règles de style');
  
  const profile = await prisma.agentProfile.findUnique({
    where: { agentId: state.agentId },
    select: { styleRules: true, locale: true }
  });
  
  const isFrench = (profile?.locale || '').toLowerCase().startsWith('fr');
  
  // Récupérer l'historique récent pour anti-répétition
  const recentMessages = await prisma.message.findMany({
    where: {
      conversation: {
        contactId: state.contactId
      },
      sender: 'ai'
    },
    orderBy: { timestamp: 'desc' },
    take: 5,
    select: { message_text: true }
  });
  
  const recentPhrases = recentMessages.length > 0
    ? recentMessages.map(m => `- "${m.message_text.substring(0, 50)}${m.message_text.length > 50 ? '...' : ''}"`).join('\n')
    : isFrench ? '(Aucun message récent)' : '(No recent messages)';
  
  const antiRepeatBlock = isFrench
    ? `[PHRASES DÉJÀ UTILISÉES - INTERDICTION DE RÉPÉTER]:\n${recentPhrases}\n\nRÈGLE: Varie tes expressions. Ne répète jamais ces phrases mot pour mot.`
    : `[PHRASES ALREADY USED - DO NOT REPEAT]:\n${recentPhrases}\n\nRULE: Vary your expressions. Never repeat these phrases word for word.`;
  
  const styleContext = `[COMMENT PARLER]:
${profile?.styleRules || (isFrench ? 'Style ado naturel, court (3-8 mots).' : 'Natural teen style, short (3-8 words).')}

${antiRepeatBlock}`;
  
  return {
    contexts: {
      ...state.contexts,
      style: styleContext
    }
  };
}
