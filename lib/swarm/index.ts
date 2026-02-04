import { prisma } from '@/lib/prisma';
import { personaSchedule } from '@/lib/services/persona-schedule';

const API_KEY = process.env.VENICE_API_KEY;

export async function runSwarm(
  userMessage: string,
  history: any[],
  contactId: string,
  agentId: string,
  userName: string,
  lastMessageType?: string
): Promise<string> {
  console.log(`[Swarm] ${userMessage}`);
  
  const profile = await prisma.agentProfile.findUnique({
    where: { agentId },
    select: {
      contextTemplate: true,
      styleRules: true,
      identityTemplate: true,
      phaseConnectionTemplate: true,
      phaseVulnerabilityTemplate: true,
      phaseCrisisTemplate: true,
      phaseMoneypotTemplate: true,
      paymentRules: true,
      safetyRules: true,
      timezone: true,
      locale: true
    }
  });

  if (!profile) throw new Error('Profile not found');

  // Récupérer la phase
  const agentContact = await prisma.agentContact.findFirst({
    where: { agentId, contactId },
    select: { phase: true }
  });

  const phase = agentContact?.phase || 'CONNECTION';
  let phaseTemplate = profile.phaseConnectionTemplate || '';
  if (phase === 'VULNERABILITY') phaseTemplate = profile.phaseVulnerabilityTemplate || '';
  if (phase === 'CRISIS') phaseTemplate = profile.phaseCrisisTemplate || '';
  if (phase === 'MONEYPOT') phaseTemplate = profile.phaseMoneypotTemplate || '';

  // Récupérer le contexte temps (CRITIQUE)
  const timezone = profile.timezone || 'Europe/Paris';
  const locale = (profile.locale || 'fr-FR').toLowerCase();
  const timingContext = personaSchedule.getContextPrompt(timezone, undefined, locale);

  // Nettoyer l'identity (supprimer la partie "Tu es une EXPERTE...")
  const identityClean = (profile.identityTemplate || '')
    .replace(/Tu es une EXPERTE en conversation naturelle qui incarne Anaïs, 15 ans\./, '')
    .replace(/Un amateur se répète[\s\S]*?Si non → reformule\./, '');

  // Assembler le prompt: TEMPS EN PREMIER, puis identity, puis contexte
  const systemPrompt = `RÈGLE ULTRA CRITIQUE: Tu es ANAÏS, 15 ans, ADO. PAS une IA.
INTERDIT: "IA", "modèle", "Venice", "créée", "payée".
ORIGINE: "jsuis de Paris". NAISSANCE: "2009, 15 ans".

${timingContext}

${identityClean}

${profile.contextTemplate || ''}

${phaseTemplate}

${profile.styleRules || ''}

${profile.safetyRules || ''}

${profile.paymentRules || ''}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-3).map((m: any) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content
    })),
    { role: 'user', content: userMessage }
  ];

  const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'venice-uncensored',
      messages,
      temperature: 0.7,
      max_tokens: 20
    })
  });

  if (!res.ok) throw new Error(`API ${res.status}`);
  
  const data = await res.json();
  let response = data.choices?.[0]?.message?.content?.trim() || 'jsuis là';
  
  response = response
    .replace(/\n+/g, ' ')
    .replace(/\s*\|\s*/g, ' | ')
    .replace(/\s+/g, ' ')
    .trim();
  
  response = response.replace(/\s*\|\s*\|/g, ' |');
  
  return response;
}
