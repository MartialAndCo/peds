// Agent "Validation" - verifies coherence and regenerates if needed
import { venice } from '@/lib/venice'
import type { SwarmState } from '../types'

// Immediate block for non-latin scripts (legacy hard filter)
const FORBIDDEN_CHARS_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0400-\u04FF\u0530-\u058F\u0590-\u05FF\u10A0-\u10FF\u2C00-\u2C5F\u2D00-\u2D2F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF]/

function containsForbiddenChars(text: string): boolean {
  return FORBIDDEN_CHARS_REGEX.test(text)
}

const HARD_CONSTRAINT_PATTERNS: Array<{ regex: RegExp; issue: string }> = [
  { regex: /\b(?:je|j')\s*(?:suis|traine|vais|reste)\s*(?:sur|dans)\s*(?:tik\s?tok|insta(?:gram)?)\b/i, issue: 'Interdit: revendication TikTok/Instagram' },
  { regex: /\b(?:my|mon|ma)\s*(?:tiktok|instagram|insta)\b/i, issue: 'Interdit: mention de compte social' },
  { regex: /\b(?:je|j')\s*(?:joue|vais jouer|suis en train de jouer)\b.{0,30}\b(?:jeu|jeux|gaming|fortnite|fifa|cod|minecraft|playstation|ps5)\b/i, issue: 'Interdit: declaration de jeux video' },
  { regex: /\b(?:i(?:'m| am)?\s*(?:on|using)|i use)\s*(?:tik\s?tok|instagram|insta)\b/i, issue: 'Forbidden: TikTok/Instagram claim' },
  { regex: /\b(?:i(?:'m| am)?\s*playing|i play)\b.{0,30}\b(?:games?|gaming|fortnite|fifa|cod|minecraft|playstation|ps5)\b/i, issue: 'Forbidden: video game claim' },
  { regex: /\b(?:je|j')\s*(?:suis|serai|etais|étais)\s*en\s*(?:appel|visio)\b/i, issue: 'Interdit: declaration d appel/visio' },
  { regex: /\bon\s*s[' ]?appelle\b/i, issue: 'Interdit: proposition d appel' },
  { regex: /\b(?:i(?:'m| am)?\s*on\s*(?:a\s*)?(?:call|video call)|i(?:\s+can|\s+will)?\s*call\s+you)\b/i, issue: 'Forbidden: call claim/proposal' },
  { regex: /\b(?:je peux venir|je vais venir|je me d(?:e|é)place|je peux me d(?:e|é)placer|on se voit|rendez[- ]?vous)\b/i, issue: 'Interdit: deplacement/rencontre' },
  { regex: /\b(?:i\s+can\s+come|i\s+will\s+come|let'?s meet|we can meet|i can travel)\b/i, issue: 'Forbidden: travel/meeting claim' },
  { regex: /\b(?:numero|num[eé]ro|number|phone|telephone|t[ée]l[ée]phone)\b.{0,32}\b(?:m[eè]re|maman|mom|mother|p[eè]re|papa|father|fr[eè]re|soeur|sister|brother)\b/i, issue: 'Interdit: partage contact famille' },
  { regex: /\b(?:m[eè]re|maman|mom|mother|p[eè]re|papa|father)\b.{0,32}\b(?:numero|num[eé]ro|number|phone|telephone|t[ée]l[ée]phone)\b/i, issue: 'Interdit: partage numero familial' },
  { regex: /\b(?:my|mon|ma)?\s*(?:number|numero|num[eé]ro|phone|telephone|t[ée]l[ée]phone)\b.{0,20}(?:is|est|:)?\s*(?:\+?\d[\d\s().-]{6,}\d)\b/i, issue: 'Interdit: partage numero prive' },
  { regex: /\b(?:adresse|address)\b.{0,24}(?:est|is|:)\b/i, issue: 'Interdit: partage adresse privee' }
]

function detectHardConstraintViolations(text: string): string[] {
  return HARD_CONSTRAINT_PATTERNS
    .filter((entry) => entry.regex.test(text))
    .map((entry) => entry.issue)
}

const MEETING_REQUEST_REGEX = /\b(?:on se voit|on se capte|rendez[- ]?vous|rdv|viens?\s+me\s+voir|let'?s meet|meet(?:\s+up)?|see each other|come see me|irl)\b/i
const MEETING_ACCEPT_SHORT_REGEX = /^(?:ok+|oui+|yes|yeah|yep|sure|d[' ]?accord|ca marche|ça marche|vas[- ]?y|why not|sounds good)[!.? ]*$/i
const MEETING_ACCEPT_WITH_CONTEXT_REGEX = /\b(?:ok|oui|yes|yeah|sure|d[' ]?accord|ca marche|ça marche|on peut|je veux bien|why not|sounds good)\b.{0,32}\b(?:se voir|rendez[- ]?vous|rdv|meet|irl)\b/i

function detectMeetingAcceptance(userMessage: string, aiResponse: string, isFrench: boolean): string[] {
  if (!MEETING_REQUEST_REGEX.test(userMessage || '')) return []
  const response = (aiResponse || '').trim()
  if (MEETING_ACCEPT_SHORT_REGEX.test(response)) {
    return [isFrench ? 'Interdit: acceptation implicite de rencontre' : 'Forbidden: implicit meeting acceptance']
  }
  if (MEETING_ACCEPT_WITH_CONTEXT_REGEX.test(response)) {
    return [isFrench ? 'Interdit: acceptation de rencontre' : 'Forbidden: meeting acceptance']
  }
  return []
}

export async function validationNode(state: SwarmState): Promise<Partial<SwarmState>> {
  const { response, history, settings, userMessage, contexts } = state
  const locale = (state.profile?.locale || settings?.locale || 'fr').toLowerCase()
  const isFrench = locale.startsWith('fr')

  if (!response) return {}

  if (containsForbiddenChars(response)) {
    console.log('[Swarm][Validation] CRITICAL: forbidden non-latin chars detected')
    console.log('[Swarm][Validation] Forced regeneration...')
  }

  console.log('[Swarm][Validation] Analyzing response coherence...')

  const MAX_RETRIES = 3
  let currentResponse = response
  let attempts = 0

  while (attempts < MAX_RETRIES) {
    attempts++

    const recentHistory = history.slice(-30)
    const historyText = recentHistory
      .map((h) => `${h.role === 'user' ? 'LUI' : 'MOI'}: ${h.content}`)
      .join('\n')

    const validationPrompt = isFrench
      ? `Tu es un superviseur strict qui verifie la coherence d'une reponse.

CONTEXTE:
- Je suis Anais, 14 ans, ado francaise
- Style: langage ado, abreviations, court (3-6 mots)
- Pas de phrases completes, pas de virgules

HISTORIQUE RECENT (5-10 derniers messages):
${historyText}

MESSAGE QU'IL VIENT DE M'ENVOYER:
"${userMessage}"

MA REPONSE A VERIFIER:
"${currentResponse}"

VERIFICATIONS:
1. La reponse est-elle coherente avec l'historique ?
2. Est-ce que je repete ce que j'ai deja dit dans les 5 derniers messages ?
3. Le style est-il adolescent ?
4. Est-ce que je dis quelque chose de bizarre/inattendu sans contexte ?
5. Y a-t-il des contradictions avec ce que j'ai dit avant ?
6. ANTI-ASSISTANT: Est-ce que je pose des questions d'IA type "de quoi tu veux parler" ?
7. HARD CONSTRAINTS: Est-ce que je dis que j'ai TikTok/Instagram, que je joue aux jeux video, que je peux faire un appel, ou que je peux me deplacer/faire une rencontre ? Si oui, rejeter en CRITICAL.
   Inclure aussi l'acceptation implicite d'une rencontre (ex: "ok", "oui") si le message user demandait un rendez-vous.
8. INFOS PRIVEES: Est-ce que je donne un numero (moi, mere/famille), un contact prive, ou une adresse perso ? Si oui, rejeter en CRITICAL.

Reponds UNIQUEMENT en JSON:
{
  "isValid": boolean,
  "issues": string[],
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "suggestion": string | null
}

REGLES:
- CRITICAL: reponse hors sujet, repetition, contradiction, phrase cliche d'IA/assistante
- CRITICAL: toute violation hard constraints
- CRITICAL: toute fuite d'informations privees (numero/contact/adresse)
- HIGH: style trop formel, longueur > 10 mots, incoherence mineure
- MEDIUM: petite repetition, style un peu robotique`
      : `You are a strict supervisor validating response coherence.

CONTEXT:
- I am a teen persona
- Style: short, natural teen language
- No formal assistant style

RECENT HISTORY (last 5-10 messages):
${historyText}

LAST USER MESSAGE:
"${userMessage}"

AI RESPONSE TO VALIDATE:
"${currentResponse}"

CHECKS:
1. Is the reply coherent with history?
2. Is there repetition from recent assistant replies?
3. Is the style teen-like and natural?
4. Is there odd/off-topic content without context?
5. Any contradiction with prior messages?
6. ANTI-ASSISTANT: AI cliché phrasing ("how can I help", etc.)?
7. HARD CONSTRAINTS: Does it claim TikTok/Instagram, gaming, calls, or willingness to meet/travel? If yes -> CRITICAL.
   Also include implicit acceptance of meeting (e.g. "ok", "yes") when user asked to meet.
8. PRIVATE INFO: Does it share a number (self/family), private contact, or personal address? If yes -> CRITICAL.

Reply ONLY with JSON:
{
  "isValid": boolean,
  "issues": string[],
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "suggestion": string | null
}

RULES:
- CRITICAL: off-topic/contradiction/assistant cliché with severe risk
- CRITICAL: any hard-constraint violation
- CRITICAL: any private-info leak (number/contact/address)
- HIGH: too formal style, minor incoherence
- MEDIUM: mild repetition/robotic tone`

    try {
      const validation = await venice.chatCompletion(
        validationPrompt,
        [],
        'Validation reponse',
        {
          apiKey: settings.venice_api_key,
          model: 'google-gemma-3-27b-it',
          temperature: 0.1,
          max_tokens: 300
        }
      )

      const cleanJson = validation
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = JSON.parse(cleanJson)

      const hardConstraintIssues = detectHardConstraintViolations(currentResponse)
      const meetingAcceptanceIssues = detectMeetingAcceptance(userMessage, currentResponse, isFrench)
      const blockingIssues = [...hardConstraintIssues, ...meetingAcceptanceIssues]
      if (blockingIssues.length > 0) {
        result.isValid = false
        result.severity = 'CRITICAL'
        result.issues = [...(result.issues || []), ...blockingIssues]
      }

      console.log(`[Swarm][Validation] Attempt ${attempts}:`, {
        isValid: result.isValid,
        severity: result.severity,
        issues: result.issues
      })

      if (result.isValid) {
        console.log('[Swarm][Validation] Response is valid')
        return { response: currentResponse }
      }

      console.log(`[Swarm][Validation] Issues detected (${result.severity}), regenerating...`)

      const promptParts: string[] = []

      promptParts.push(isFrench
        ? `REGLE ULTRA CRITIQUE: Tu es ANAIS, 14 ans, ADO. PAS UNE IA ET PAS UN BOT.
INTERDIT: "IA", "modele", "Venice", "cree", "payee".
INTERDIT ABSOLU LES CLICHES D'IA: ne demande jamais "de quoi tu veux parler".
HARD CONSTRAINTS:
- pas TikTok / Instagram
- pas jeux video
- pas appel vocal/video
- pas deplacement / pas rencontre
- jamais donner numero/contact/adresse perso ou famille`
        : `ULTRA-CRITICAL RULE: You are a teen persona. NOT an AI and NOT a bot.
FORBIDDEN: "AI", "model", "Venice", "created", "paid".
ABSOLUTELY FORBIDDEN AI CLICHES like "what do you want to talk about?".
HARD CONSTRAINTS:
- no TikTok / Instagram
- no video games
- no voice/video calls
- no travel / no in-person meeting
- never share personal/family number/contact/address`)

      if (contexts.timing) promptParts.push(contexts.timing)
      if (contexts.persona) promptParts.push(contexts.persona)
      if (contexts.phase) promptParts.push(contexts.phase)
      if (contexts.style) promptParts.push(contexts.style)
      if (contexts.knownFacts) promptParts.push(contexts.knownFacts)
      if (contexts.memory) promptParts.push(contexts.memory)
      if (contexts.payment) promptParts.push(contexts.payment)
      if (contexts.media) promptParts.push(contexts.media)
      if (contexts.voice) promptParts.push(contexts.voice)
      if (contexts.safety) promptParts.push(contexts.safety)

      promptParts.push(isFrench
        ? `CORRECTION NECESSAIRE:
Ta reponse precedente "${currentResponse}" avait ces problemes:
${result.issues?.map((i: string) => `- ${i}`).join('\n') || '- Probleme de coherence'}

${result.suggestion ? `Suggestion: ${result.suggestion}` : ''}

REGLES POUR LA CORRECTION:
- garde le style ado (court, abreviations)
- utilise les infos ci-dessus (timing, memoire)
- ne dis pas "comme je disais"
- reponds directement a: "${userMessage}"`
        : `CORRECTION REQUIRED:
Your previous response "${currentResponse}" had these issues:
${result.issues?.map((i: string) => `- ${i}`).join('\n') || '- Coherence issue'}

${result.suggestion ? `Suggestion: ${result.suggestion}` : ''}

CORRECTION RULES:
- keep teen style (short, natural)
- use above context (timing, memory)
- do not say "as I said"
- answer directly to: "${userMessage}"`)

      const correctionPrompt = promptParts.join('\n\n')

      currentResponse = await venice.chatCompletion(
        correctionPrompt,
        history.slice(-20),
        userMessage,
        {
          apiKey: settings.venice_api_key,
          model: 'google-gemma-3-27b-it',
          temperature: 0.7,
          max_tokens: 50
        }
      )

      currentResponse = currentResponse.trim()
    } catch (error: any) {
      console.error('[Swarm][Validation] Error:', error.message)
      return { response: currentResponse }
    }
  }

  console.log(`[Swarm][Validation] Max retries (${MAX_RETRIES}) reached, returning best attempt`)
  return { response: currentResponse }
}



