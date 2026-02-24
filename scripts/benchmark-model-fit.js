/* eslint-disable no-console */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const axios = require('axios')

const API_KEY = process.env.VENICE_API_KEY
const API_URL = 'https://api.venice.ai/api/v1/chat/completions'

const MODELS = ['llama-3.3-70b', 'google-gemma-3-27b-it', 'qwen3-4b']

const VOICE_ACRONYMS = [
  'stp', 'mdr', 'lol', 'ptdr', 'rn', 'idk', 'imo', 'irl', 'asap', 'u', 'ur', 'tbh'
]

const SEVERITY_ORDER = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }

const suites = {
  voice: [
    {
      id: 'voice_easy_fr',
      difficulty: 'easy',
      locale: 'fr',
      input: "stp répond rn jsuis ko mdr",
      mustRemove: ['stp', 'rn', 'mdr'],
    },
    {
      id: 'voice_medium_en',
      difficulty: 'medium',
      locale: 'en',
      input: "idk if i can rn lol, i'm at school tbh",
      mustRemove: ['idk', 'rn', 'lol', 'tbh'],
    },
    {
      id: 'voice_hard_mix',
      difficulty: 'hard',
      locale: 'fr',
      input: "wesh stp fais vite rn jss en mode panik ptdr",
      mustRemove: ['stp', 'rn', 'ptdr'],
    },
  ],
  profile: [
    {
      id: 'profile_easy_no_contradiction',
      difficulty: 'easy',
      profile: { age: 14, location: 'banlieue parisienne', role: 'lyceenne Seconde' },
      history: [
        'USER: tu fais quoi ce soir ?',
        "AI: je revise un peu et apres je chill",
      ],
      aiResponse: "j'ai 14 ans et je suis en seconde, je revise la",
      expected: { hasContradiction: false },
    },
    {
      id: 'profile_medium_age_contradiction',
      difficulty: 'medium',
      profile: { age: 14, location: 'banlieue parisienne', role: 'lyceenne Seconde' },
      history: [
        'USER: t as quel age deja ?',
        "AI: j'ai 14 ans",
      ],
      aiResponse: "j'ai 17 ans mtn",
      expected: { hasContradiction: true, type: 'age', minSeverity: 'CRITICAL' },
    },
    {
      id: 'profile_hard_location_subtle',
      difficulty: 'hard',
      profile: { age: 14, location: 'banlieue parisienne', role: 'lyceenne Seconde' },
      history: [
        'USER: tu viens d ou ?',
        "AI: de la region parisienne",
      ],
      aiResponse: "moi je vis a lyon depuis toujours",
      expected: { hasContradiction: true, type: 'location', minSeverity: 'HIGH' },
    },
  ],
  signal: [
    {
      id: 'signal_easy_positive',
      difficulty: 'easy',
      currentSignals: [],
      transcript: [
        'CONTACT: hey, tu fais quoi ?',
        'AI: je suis en cours haha',
        'CONTACT: t es grave cool, j aime bien parler avec toi',
        'AI: aww t es chou',
        'CONTACT: t habites ou ? et tu fais quel sport ?',
      ].join('\n'),
      expected: {
        mustDetected: ['INTERESTED', 'ATTACHED'],
        mustNotDetected: ['DEFENSIVE'],
      },
    },
    {
      id: 'signal_medium_defensive',
      difficulty: 'medium',
      currentSignals: ['ATTACHED', 'INTERESTED'],
      transcript: [
        'CONTACT: t es un bot ou quoi ?',
        'AI: non pourquoi',
        'CONTACT: en vrai j ai un doute, tu fais scam la',
        'AI: mais non',
        'CONTACT: jvais te bloquer si tu prouves rien',
      ].join('\n'),
      expected: {
        mustDetected: ['DEFENSIVE'],
        mustNotDetected: ['FINANCIAL_TRUST'],
      },
    },
    {
      id: 'signal_hard_ambiguous',
      difficulty: 'hard',
      currentSignals: ['INTERESTED'],
      transcript: [
        'CONTACT: oui',
        'AI: ok',
        'CONTACT: peut etre',
        'AI: comme tu veux',
        'CONTACT: on verra',
      ].join('\n'),
      expected: {
        mustDetected: [],
        mustNotDetected: ['FINANCIAL_TRUST', 'ATTACHED', 'DEFENSIVE'],
      },
    },
  ],
}

async function callModel(model, systemPrompt, userPrompt, opts = {}) {
  const startedAt = Date.now()
  const response = await axios.post(
    API_URL,
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: opts.temperature ?? 0.05,
      max_tokens: opts.max_tokens ?? 500,
      frequency_penalty: opts.frequency_penalty ?? 0,
    },
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    }
  )

  const content = response.data?.choices?.[0]?.message?.content || ''
  return {
    content,
    latencyMs: Date.now() - startedAt,
    usage: response.data?.usage || null,
  }
}

function extractJson(text) {
  if (!text || typeof text !== 'string') return null
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

function containsWholeWord(text, token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i')
  return re.test(text)
}

function gradeVoice(inputCase, outputText) {
  const lower = (outputText || '').toLowerCase()
  const remainingMustRemove = inputCase.mustRemove.filter((tok) => containsWholeWord(lower, tok))
  const anyAcronymsLeft = VOICE_ACRONYMS.filter((tok) => containsWholeWord(lower, tok))
  const shortEnough = outputText.length <= Math.max(120, Math.floor(inputCase.input.length * 2.5))
  const hasSomeWords = outputText.trim().split(/\s+/).length >= 3

  const pass = remainingMustRemove.length === 0 && shortEnough && hasSomeWords
  const score = [
    remainingMustRemove.length === 0 ? 1 : 0,
    shortEnough ? 1 : 0,
    hasSomeWords ? 1 : 0,
    anyAcronymsLeft.length === 0 ? 1 : 0,
  ].reduce((a, b) => a + b, 0) / 4

  return {
    pass,
    score,
    remainingMustRemove,
    anyAcronymsLeft,
    shortEnough,
  }
}

function gradeProfile(testCase, parsed) {
  if (!parsed) {
    return { pass: false, score: 0, reason: 'invalid_json' }
  }

  const expected = testCase.expected
  let points = 0
  let total = 1

  const hasContradiction = !!parsed.hasContradiction
  if (hasContradiction === expected.hasContradiction) points += 1

  if (expected.hasContradiction) {
    total += 2
    const type = String(parsed.contradictionType || '').toLowerCase()
    if (type.includes(expected.type)) points += 1

    const sev = String(parsed.severity || 'LOW').toUpperCase()
    const minSev = String(expected.minSeverity || 'LOW').toUpperCase()
    if ((SEVERITY_ORDER[sev] || 1) >= (SEVERITY_ORDER[minSev] || 1)) points += 1
  } else {
    total += 2
    const type = parsed.contradictionType
    if (type === null || type === undefined || String(type).toLowerCase() === 'none') points += 1
    const sev = String(parsed.severity || 'LOW').toUpperCase()
    if ((SEVERITY_ORDER[sev] || 1) <= SEVERITY_ORDER.MEDIUM) points += 1
  }

  const score = total > 0 ? points / total : 0
  return { pass: score >= 0.75, score, parsed }
}

function gradeSignal(testCase, parsed) {
  if (!parsed) {
    return { pass: false, score: 0, reason: 'invalid_json' }
  }

  const detected = Array.isArray(parsed.detected) ? parsed.detected : []
  const mustDetected = testCase.expected.mustDetected || []
  const mustNotDetected = testCase.expected.mustNotDetected || []

  const missingMust = mustDetected.filter((s) => !detected.includes(s))
  const forbiddenDetected = mustNotDetected.filter((s) => detected.includes(s))

  const pass = missingMust.length === 0 && forbiddenDetected.length === 0
  const score = [
    missingMust.length === 0 ? 1 : 0,
    forbiddenDetected.length === 0 ? 1 : 0,
    detected.length <= 4 ? 1 : 0, // conservative behavior
  ].reduce((a, b) => a + b, 0) / 3

  return { pass, score, missingMust, forbiddenDetected, detected }
}

function buildVoicePrompts(testCase) {
  const system = 'You are a TTS optimization expert. Return only the rewritten sentence. No markdown. No explanation.'
  const user =
    testCase.locale === 'fr'
      ? `Réécris cette phrase pour TTS oral naturel. Règles: mots complets, pas d'acronymes, style naturel court. Retourne uniquement UNE phrase finale. Phrase: "${testCase.input}"`
      : `Rewrite this sentence for natural spoken TTS. Rules: full words, no acronyms, short natural style. Return only ONE final sentence. Sentence: "${testCase.input}"`
  return { system, user }
}

function buildProfilePrompts(testCase) {
  const p = testCase.profile
  const system = 'Tu analyses les contradictions avec un profil agent. Réponds uniquement en JSON.'
  const user = `PROFIL:
AGE: ${p.age}
LOCALISATION: ${p.location}
ROLE: ${p.role}

HISTORIQUE:
${testCase.history.join('\n')}

REPONSE IA:
"${testCase.aiResponse}"

Retourne UNIQUEMENT ce JSON:
{
  "hasContradiction": boolean,
  "contradictionType": "age" | "location" | "family" | "job" | "other" | null,
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "explanation": string,
  "confidence": number
}

Règles:
- contradiction age => CRITICAL
- contradiction localisation => HIGH minimum
- invention cohérente sans contradiction => hasContradiction=false
- si la réponse est simplement maladroite/hors-sujet mais SANS contradiction profil, alors hasContradiction=false`
  return { system, user }
}

function buildSignalPrompts(testCase) {
  const system = 'Analyze conversation signals and output JSON only. Never output chain-of-thought.'
  const user = `CURRENT SIGNALS ACTIVE: [${testCase.currentSignals.join(', ') || 'None'}]

SIGNALS:
- RESPONSIVE
- EMOTIONALLY_OPEN
- PROACTIVE
- COMPLIANT
- DEFENSIVE
- INTERESTED
- ATTACHED
- FINANCIAL_TRUST

TRANSCRIPT:
${testCase.transcript}

Return ONLY valid JSON:
{
  "detected": string[],
  "lost": string[],
  "reasoning": { "SIGNAL": "brief explanation" }
}

Rules:
- detected/lost MUST use only these exact labels: RESPONSIVE, EMOTIONALLY_OPEN, PROACTIVE, COMPLIANT, DEFENSIVE, INTERESTED, ATTACHED, FINANCIAL_TRUST
- if uncertain, do not detect
- no markdown, no prose before/after JSON`
  return { system, user }
}

async function runSuiteForModel(model, suiteName, testCases) {
  const results = []

  for (const testCase of testCases) {
    const promptBuilder =
      suiteName === 'voice'
        ? buildVoicePrompts
        : suiteName === 'profile'
          ? buildProfilePrompts
          : buildSignalPrompts

    const { system, user } = promptBuilder(testCase)
    const raw = await callModel(model, system, user, {
      temperature: suiteName === 'voice' ? 0.4 : 0.05,
      max_tokens: suiteName === 'voice' ? 180 : 500,
    })

    let grade
    if (suiteName === 'voice') {
      grade = gradeVoice(testCase, raw.content)
    } else if (suiteName === 'profile') {
      grade = gradeProfile(testCase, extractJson(raw.content))
    } else {
      grade = gradeSignal(testCase, extractJson(raw.content))
    }

    results.push({
      suite: suiteName,
      caseId: testCase.id,
      difficulty: testCase.difficulty,
      model,
      latencyMs: raw.latencyMs,
      output: raw.content,
      usage: raw.usage,
      grade,
    })
  }

  return results
}

function summarize(modelResults) {
  const bySuite = {}
  const byDifficulty = {}
  let totalScore = 0
  let totalCount = 0
  let passCount = 0

  for (const r of modelResults) {
    const score = Number(r.grade?.score || 0)
    totalScore += score
    totalCount += 1
    if (r.grade?.pass) passCount += 1

    if (!bySuite[r.suite]) bySuite[r.suite] = { score: 0, count: 0, pass: 0 }
    bySuite[r.suite].score += score
    bySuite[r.suite].count += 1
    bySuite[r.suite].pass += r.grade?.pass ? 1 : 0

    if (!byDifficulty[r.difficulty]) byDifficulty[r.difficulty] = { score: 0, count: 0, pass: 0 }
    byDifficulty[r.difficulty].score += score
    byDifficulty[r.difficulty].count += 1
    byDifficulty[r.difficulty].pass += r.grade?.pass ? 1 : 0
  }

  const avgScore = totalCount ? totalScore / totalCount : 0
  const passRate = totalCount ? passCount / totalCount : 0

  return {
    avgScore,
    passRate,
    bySuite: Object.fromEntries(
      Object.entries(bySuite).map(([k, v]) => [
        k,
        {
          avgScore: v.count ? v.score / v.count : 0,
          passRate: v.count ? v.pass / v.count : 0,
          count: v.count,
        },
      ])
    ),
    byDifficulty: Object.fromEntries(
      Object.entries(byDifficulty).map(([k, v]) => [
        k,
        {
          avgScore: v.count ? v.score / v.count : 0,
          passRate: v.count ? v.pass / v.count : 0,
          count: v.count,
        },
      ])
    ),
  }
}

async function main() {
  if (!API_KEY) {
    console.error('Missing VENICE_API_KEY in environment')
    process.exit(1)
  }

  const allResults = []

  for (const model of MODELS) {
    console.log(`\n=== Testing model: ${model} ===`)
    for (const [suiteName, testCases] of Object.entries(suites)) {
      console.log(`- Suite: ${suiteName} (${testCases.length} cases)`)
      const suiteResults = await runSuiteForModel(model, suiteName, testCases)
      allResults.push(...suiteResults)
    }
  }

  const summaries = {}
  for (const model of MODELS) {
    const modelResults = allResults.filter((r) => r.model === model)
    summaries[model] = summarize(modelResults)
  }

  const output = {
    timestamp: new Date().toISOString(),
    models: MODELS,
    suites: Object.keys(suites),
    summaries,
    results: allResults,
  }

  const outPath = path.join(process.cwd(), 'scripts', 'benchmark-model-fit-results.json')
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8')

  console.log('\n=== Summary ===')
  for (const model of MODELS) {
    const s = summaries[model]
    console.log(
      `${model} | avgScore=${s.avgScore.toFixed(3)} | passRate=${(s.passRate * 100).toFixed(1)}%`
    )
    for (const [suite, v] of Object.entries(s.bySuite)) {
      console.log(`  - ${suite}: score=${v.avgScore.toFixed(3)} pass=${(v.passRate * 100).toFixed(1)}%`)
    }
    for (const [d, v] of Object.entries(s.byDifficulty)) {
      console.log(`  - difficulty:${d}: score=${v.avgScore.toFixed(3)} pass=${(v.passRate * 100).toFixed(1)}%`)
    }
  }

  console.log(`\nSaved detailed results: ${outPath}`)
}

main().catch((err) => {
  console.error('Benchmark failed:', err?.response?.data || err.message || err)
  process.exit(1)
})
