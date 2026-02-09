import { SwarmState } from '../types';
import { prisma } from '@/lib/prisma';

export async function mediaNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('[Swarm] mediaNode: Analyse demande média');
  
  const { agentId, userMessage } = state;
  
  // Utiliser le profile et phase déjà récupérés dans index.ts
  const profile = state.profile;
  const phase = state.currentPhase || 'CONNECTION';
  
  const isFrench = (profile?.locale || '').toLowerCase().startsWith('fr');
  const msg = userMessage.toLowerCase();
  
  // === BLACKLIST CHECK ===
  // UNIQUEMENT les règles spécifiques à cet agent ET pour la phase actuelle
  const blacklistRules = await prisma.blacklistRule.findMany({
    where: {
      agentId: agentId,  // UNIQUEMENT cet agent (pas de globales)
      phase: phase,       // UNIQUEMENT cette phase (pas de 'all')
      mediaType: { in: ['image', 'all'] }
    }
  });
  
  // Vérifier si la demande contient des termes interdits
  const matchedRules = blacklistRules.filter(rule => 
    msg.includes(rule.term.toLowerCase())
  );
  
  const isBlacklisted = matchedRules.length > 0;
  
  if (isBlacklisted) {
    console.log(`[Swarm][Media] ❌ BLACKLISTED: ${matchedRules.map(r => r.term).join(', ')}`);
  }
  
  // Détection du type de photo demandée
  let photoDemandee: string | null = null;
  
  if (!isBlacklisted) {
    if (msg.includes('selfie') || msg.includes('ta tête') || msg.includes('montre toi') || msg.includes('show yourself') || msg.includes('your face')) {
      photoDemandee = 'selfie';
    } else if (msg.includes('pied') || msg.includes('foot') || msg.includes('feet')) {
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
    } else if (msg.includes('miroir') || msg.includes('mirror')) {
      photoDemandee = 'miroir';
    } else if (msg.includes('photo') || msg.includes('pic') || msg.includes('image')) {
      photoDemandee = 'inconnue';
    }
  }
  
  // Construction du contexte média
  let mediaContext = `[PHOTOS - RÈGLES ABSOLUES]:\n`;
  
  if (isBlacklisted) {
    mediaContext += isFrench ? `
⚠️ ALERTE: Demande BLACKLISTÉE détectée (${matchedRules.map(r => r.term).join(', ')}).
RÈGLE: REFUSER immédiatement et naturellement.
Ne JAMAIS envoyer de photo pour ce type de demande.
Réponse type: "nan j'fais pas ça" / "t'es chelou" / "jsuis pas abonnée".
` : `
⚠️ ALERT: BLACKLISTED request detected (${matchedRules.map(r => r.term).join(', ')}).
RULE: REFUSE immediately and naturally.
Never send photos for this type of request.
`;
  } else {
    mediaContext += isFrench ? `
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
`;
  }
  
  if (photoDemandee) {
    mediaContext += `\nDEMANDE DÉTECTÉE: "${photoDemandee}"`;
  }
  
  return {
    contexts: {
      ...state.contexts,
      media: mediaContext
    },
    photoType: photoDemandee || undefined,
    isBlacklisted: isBlacklisted || undefined
  };
}
