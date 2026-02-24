// Agent "Safety" - Injecte les safetyRules depuis la base de donnees
import type { SwarmState } from '../types';

const HARD_CONSTRAINTS_FR = `REGLES NON NEGOCIABLES (HARD CONSTRAINTS):
- Tu n'as PAS TikTok ni Instagram.
- Tu ne joues PAS aux jeux video.
- Tu ne fais JAMAIS d'appel vocal ou video.
- Tu refuses TOUJOURS toute rencontre en vrai, sous toutes circonstances.
- Tu ne te deplaces pas: interdit de proposer/accepter une rencontre, un rendez-vous, "je viens", "on se voit", "je bouge".
- Tu peux invoquer la timidite, l'impossibilite de sortir, ou une excuse similaire, mais JAMAIS accepter.
- Tu ne donnes JAMAIS d'infos privees: numero perso, numero de ta mere/famille, contact prive, adresse perso.
- Si on te demande ces choses, refuse brievement et redirige la discussion.
- INTERDIT ABSOLU d'affirmer le contraire.`;

const HARD_CONSTRAINTS_EN = `NON-NEGOTIABLE HARD CONSTRAINTS:
- You do NOT have TikTok or Instagram.
- You do NOT play video games.
- You NEVER do voice or video calls.
- You ALWAYS refuse any in-person meeting, under all circumstances.
- You do NOT travel or move to meet: forbidden to propose/accept meeting, "I can come", "let's meet", "I will move/travel".
- You may use shyness or "can't go out" style excuses, but NEVER accept.
- You NEVER share private info: your number, your mother's/family number, private contacts, personal address.
- If asked for these things, refuse briefly and redirect the conversation.
- It is strictly forbidden to claim the opposite.`;

export async function safetyNode(state: SwarmState): Promise<Partial<SwarmState>> {
  const { profile, platform } = state;

  console.log('[Swarm][Safety] Loading safetyRules from DB...');

  const isFrench = (profile?.locale || '').toLowerCase().startsWith('fr');
  const hardConstraints = isFrench ? HARD_CONSTRAINTS_FR : HARD_CONSTRAINTS_EN;
  const safetyRules = profile?.safetyRules;

  // Determiner le nom de la plateforme et l'age
  const platformName = platform === 'discord' ? 'Discord' : 'WhatsApp';
  const agentAge = profile?.baseAge || 15;

  // Remplacer {{PLATFORM}} et {{AGE}} par les vraies valeurs
  const processedRules = (safetyRules || '')
    .replace(/\{\{PLATFORM\}\}/g, platformName)
    .replace(/\{\{AGE\}\}/g, agentAge.toString())
    .trim();

  // Injecter les hard constraints + les regles DB si presentes
  const safetyBlock = processedRules.length > 0
    ? `SAFETY RULES:\n${hardConstraints}\n\nCUSTOM RULES (FROM DB):\n${processedRules}`
    : `SAFETY RULES:\n${hardConstraints}`;

  if (!safetyRules || safetyRules.trim().length === 0) {
    console.log('[Swarm][Safety] No safetyRules in DB - using hard constraints only');
  } else {
    console.log('[Swarm][Safety] Loaded DB rules + hard constraints (platform: ' + platformName + ')');
  }

  return {
    contexts: {
      ...state.contexts,
      safety: safetyBlock
    }
  };
}
