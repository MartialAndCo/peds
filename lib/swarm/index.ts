import { prisma } from '@/lib/prisma';
import { personaSchedule } from '@/lib/services/persona-schedule';
import { validationNode } from './nodes/validation-node';
import { memoryService } from '@/lib/memory';

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

  // CHARGER LES MÉMOIRES (CRITIQUE - était manquant !)
  let memoryContext = '';
  try {
    const memoryUserId = memoryService.buildUserId(contactId, agentId);
    const memories = await memoryService.getAll(memoryUserId);
    if (memories && memories.length > 0) {
      const memoryTexts = memories
        .map((m: any) => typeof m === 'string' ? m : m.memory)
        .filter(Boolean)
        .slice(0, 10); // Limiter à 10 mémoires pour ne pas surcharger
      if (memoryTexts.length > 0) {
        memoryContext = `\n\n[INFOS SUR CETTE PERSONNE - DONT TU TE SOUVIENS]:\n${memoryTexts.map((m: string) => `- ${m}`).join('\n')}`;
        console.log(`[Swarm] Loaded ${memoryTexts.length} memories for ${memoryUserId}`);
      }
    }
  } catch (e) {
    console.warn('[Swarm] Failed to load memories:', e);
  }

  // Nettoyer l'identity (supprimer la partie "Tu es une EXPERTE...")
  const identityClean = (profile.identityTemplate || '')
    .replace(/Tu es une EXPERTE en conversation naturelle qui incarne Anaïs, 14 ans\./, '')
    .replace(/Un amateur se répète[\s\S]*?Si non → reformule\./, '');

  // Assembler le prompt: TEMPS EN PREMIER, puis identity, puis contexte
  const systemPrompt = `RÈGLE ULTRA CRITIQUE: Tu es ANAÏS, 14 ans, ADO. PAS une IA.
INTERDIT: "IA", "modèle", "Venice", "créée", "payée".
ORIGINE: "jsuis de Paris". NAISSANCE: "2010, 14 ans".

${timingContext}

${identityClean}

${profile.contextTemplate || ''}

${phaseTemplate}

${profile.styleRules || ''}

${profile.safetyRules || ''}

${profile.paymentRules || ''}

${memoryContext}`;

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
  
  // Validation de cohérence
  console.log('[Swarm] Running validation...');
  const state = {
    response,
    history,
    settings: { venice_api_key: API_KEY, venice_model: 'venice-uncensored' },
    userMessage,
    contexts: { 
      persona: identityClean, 
      style: profile.styleRules || '', 
      phase: phaseTemplate,
      timing: timingContext,
      memory: memoryContext,
      payment: '',
      media: '',
      voice: ''
    },
    contactId,
    agentId,
    userName,
    lastMessageType: lastMessageType || 'text'
  };
  
  const validationResult = await validationNode(state);
  const finalResponse = validationResult.response || response;
  
  console.log(`[Swarm] Final response: "${finalResponse.substring(0, 50)}..."`);
  return finalResponse;
}
