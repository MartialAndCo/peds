import { SwarmState } from '../types';
import { prisma } from '@/lib/prisma';

export async function mediaNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] mediaNode: Analyse demande média');
  
  const profile = await prisma.agentProfile.findUnique({
    where: { agentId: state.agentId },
    select: { locale: true }
  });
  
  const isFrench = (profile?.locale || '').toLowerCase().startsWith('fr');
  
  // Analyser la demande de photo
  const msg = state.userMessage.toLowerCase();
  let photoDemandee: string | null = null;
  
  // Détection du type de photo demandée
  if (msg.includes('selfie') || msg.includes('ta tête') || msg.includes('montre toi') || msg.includes('show yourself') || msg.includes('your face')) {
    photoDemandee = 'selfie';
  } else if (msg.includes('pied') || msg.includes('foot') || msg.includes('shoe')) {
    photoDemandee = 'pieds';
  } else if (msg.includes('chat') || msg.includes('cat')) {
    photoDemandee = 'chat';
  } else if (msg.includes('chien') || msg.includes('dog')) {
    photoDemandee = 'chien';
  } else if (msg.includes('maison') || msg.includes('house') || msg.includes('room')) {
    photoDemandee = 'maison';
  } else if (msg.includes('cuisine') || msg.includes('kitchen')) {
    photoDemandee = 'cuisine';
  } else if (msg.includes('chaussure') || msg.includes('shoe')) {
    photoDemandee = 'chaussures';
  } else if (msg.includes('photo') || msg.includes('pic') || msg.includes('image')) {
    photoDemandee = 'inconnue';
  }
  
  const mediaContext = `[PHOTOS - RÈGLES ABSOLUES]:
${isFrench ? `
- [IMAGE:xxx] UNIQUEMENT si on demande EXPLICITEMENT cette photo
- Photos dispo: selfie, face, pieds, chat, chien, chambre, miroir
- INTERDICTION DE SUBSTITUTION: S'il demande "tes chaussures" → PAS [IMAGE:selfie]
- Si photo indisponible: dis "j'ai pas" ou "je montre pas ça"
- HORS PHASE MONEYPOT: Refuse les photos intimes (naturellement)
` : `
- [IMAGE:xxx] ONLY if EXPLICITLY asked for THAT photo
- Available: selfie, face, feet, cat, dog, room, mirror
- NO SUBSTITUTION: If asking "your shoes" → NOT [IMAGE:selfie]
- If unavailable: say "don't have" or "not showing that"
- OUTSIDE MONEYPOT: Refuse intimate photos (naturally)
`}
${photoDemandee ? `\nDEMANDE DÉTECTÉE: "${photoDemandee}"` : ''}`;
  
  return {
    contexts: {
      ...state.contexts,
      media: mediaContext
    },
    photoType: photoDemandee || undefined
  };
}
