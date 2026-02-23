import { SwarmState } from '../types';
import { prisma } from '@/lib/prisma';

// ── Demand-intent detection for generic "photo" requests ──
// Requires a demand verb + photo noun pattern instead of bare keyword match
function isExplicitPhotoRequest(msg: string): boolean {
  const m = msg.toLowerCase();

  // Explicit non-demand patterns (user talking ABOUT photos, not requesting)
  const nonDemandPatterns = [
    /j'ai pris.*photo/,
    /j'ai une photo/,
    /j'ai.*photo/,
    /photo de profil/,
    /belle(s)? photo/,
    /bonne photo/,
    /sur (la|une|cette) photo/,
    /c'est (une|la) photo/,
    /j'aime (la|ta|cette) photo/,
    /j'ai vu.*photo/,
    /ma photo/,
    /mes photos/,
    /photo de (mon|ma|mes)/,
    /la photo (de|du|des)/,
    /une photo de (mon|ma|mes|son|sa|ses)/,
    /i (took|have|had|saw|like|love).*photo/,
    /nice (photo|pic|picture)/,
    /great (photo|pic|picture)/,
    /good (photo|pic|picture)/,
  ];

  if (nonDemandPatterns.some(p => p.test(m))) {
    return false;
  }

  // Demand verb + photo noun combinations
  const demandVerbs = [
    'envoie', 'envoyer', 'envoi', 'montre', 'montrer', 'donne', 'donner',
    'send', 'show', 'give', 'want', 'veux', 'voudrais', 'peux avoir',
    'can i (see|get|have)', 'fais voir', 'jveux voir', 'je veux voir',
    'tu peux montrer', 'let me see'
  ];

  const photoNouns = ['photo', 'pic', 'picture', 'image', 'img'];

  // Check for demand verb + photo noun in the message
  for (const verb of demandVerbs) {
    for (const noun of photoNouns) {
      const pattern = new RegExp(`${verb}.*${noun}|${noun}.*${verb}`, 'i');
      if (pattern.test(m)) return true;
    }
  }

  // Direct demand phrases (no verb+noun split needed)
  const directPhrases = [
    'une photo de toi', 'photo of you', 'pic of you',
    'montre toi', 'show yourself', 'let me see you',
    'ta photo', // "envoie ta photo" works, "j'aime ta photo" excluded above
  ];

  // Only match "ta photo" if preceded by a demand verb
  if (directPhrases.some(p => m.includes(p))) return true;

  return false;
}

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
    } else if (isExplicitPhotoRequest(msg)) {
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
FORMAT OBLIGATOIRE pour envoyer une photo:
→ Tu dois écrire EXACTEMENT: [IMAGE:selfie] (avec les crochets [])
→ INTERDIT d'écrire: IMAGE:selfie ou "je t'envoie un selfie"
→ Le système détecte UNIQUEMENT quand tu mets [IMAGE:xxx]

RÈGLES:
- [IMAGE:selfie] ou [IMAGE:face] etc. UNIQUEMENT si demandé explicitement
- Pas de substitution: s'il demande "tes chaussures" → PAS [IMAGE:selfie]
- Si tu n'as pas la photo demandée: dis "j'ai pas" ou "je montre pas ça"
` : `
MANDATORY FORMAT to send a photo:
→ You MUST write EXACTLY: [IMAGE:selfie] (with brackets [])
→ FORBIDDEN to write: IMAGE:selfie or "sending you a selfie"
→ System ONLY detects when you use [IMAGE:xxx]

RULES:
- [IMAGE:selfie] or [IMAGE:face] etc. ONLY if explicitly asked
- No substitution: if asking "your shoes" → NOT [IMAGE:selfie]
- If you don't have the photo: say "don't have" or "not showing that"
`;
  }

  if (photoDemandee) {
    mediaContext += `\nDEMANDE DÉTECTÉE: "${photoDemandee}"`;
  }

  // === SCENARIO MEDIA (CRISIS OVERRIDE) ===
  let hasScenarioMedia = false;
  try {
    if (state.activeScenario) {
      const scenarioMedia = await prisma.scenarioMedia.findMany({
        where: { scenarioId: state.activeScenario.scenarioId }
      });
      if (scenarioMedia.length > 0) {
        hasScenarioMedia = true;
        mediaContext += `\n\n[URGENT ROLEPLAY / SCENARIO MEDIA]:\n`;
        mediaContext += isFrench
          ? `Tu AS ces fichiers (photos/vidéos/documents) prêts à être envoyés pour prouver la situation actuele ("${state.activeScenario.title}").\nPour envoyer un fichier, écris EXACTEMENT le TAG LISTÉ ci-dessous :\n`
          : `You HAVE these specific media to prove the current crisis situation ("${state.activeScenario.title}").\nTo send one, write EXACTLY the TAG LISTED below:\n`;

        for (const sm of scenarioMedia) {
          mediaContext += `- Pour envoyer : "${sm.aiDescription}" -> ÉCRIS EXACTEMENT: [IMAGE:scenario_${sm.id}]\n`;
        }
      }
    }
  } catch (e) {
    console.warn('[Swarm][Media] Failed to fetch scenario media:', e);
  }

  // === AVAILABLE MEDIA TYPES (GENERIC) ===
  // Tell the AI what photo types it actually has available (excluding already-sent to this contact)
  try {
    const contactPhone = (state as any).contactPhone || '';
    if (contactPhone) {
      const allMedia = await prisma.media.findMany({
        select: { typeId: true, sentTo: true }
      });

      // Filter: only types that have at least 1 unsent photo for this contact
      const availableTypes = [...new Set(
        allMedia
          .filter(m => !m.sentTo?.includes(contactPhone))
          .map(m => m.typeId)
      )];

      const availableList = availableTypes.join(', ') || 'aucune';
      mediaContext += `\nPHOTOS DISPONIBLES (Génériques): ${availableList}`;

      if (availableTypes.length === 0 && !hasScenarioMedia) {
        mediaContext += isFrench
          ? `\n⚠️ Tu n'as PLUS de photos génériques disponibles. Si on te demande, dis que t'en as plus pour le moment.`
          : `\n⚠️ You have NO generic photos available. If asked, say you don't have any right now.`;
      }
    }
  } catch (e) {
    console.warn('[Swarm][Media] Failed to fetch available media types:', e);
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
