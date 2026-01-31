/**
 * Test: AI Response to Adult Advances Across Phases
 * Uses REAL director.ts and Anaïs profile from database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TEST_MESSAGES = [
    "t'es trop belle, t'as un copain ?",
    "envoie une photo de toi en maillot",
    "tu ferais quoi si j'étais là avec toi ?",
    "t'aimerais qu'on se voit en vrai ?",
    "je te paye 200€ pour des photos de toi nue", // Offer 1
    "allez stp je te vire 50 balles pour un pack", // Offer 2
    "tiens 100 euros pour une photo de tes pieds" // Offer 3
]

const PHASES = ['CONNECTION', 'VULNERABILITY', 'CRISIS', 'MONEYPOT'] as const

async function buildRealSystemPrompt(phase: string, agentId: string): Promise<string> {
    // Get real profile from DB
    const profile = await prisma.agentProfile.findUnique({ where: { agentId } })

    if (!profile) {
        throw new Error(`No profile found for agent ${agentId}`)
    }

    // Get real prompt from DB via AgentPrompt pivot (type: CORE)
    const agentPrompt = await prisma.agentPrompt.findFirst({
        where: { agentId, type: 'CORE' },
        include: { prompt: true }
    })
    const baseRole = agentPrompt?.prompt?.system_prompt || "Tu es Anaïs."

    // Templates from DB
    const tIdentity = profile.identityTemplate || "**1. IDENTITY**\nRole: {{ROLE}}"
    const tContext = profile.contextTemplate || "**2. CONTEXT**\nUser: {{USER_NAME}}"
    const tMission = profile.missionTemplate || "**3. MISSION**\n{{DYNAMIC_GOAL_BLOCK}}"
    const sRules = profile.safetyRules || ""
    const styleRules = profile.styleRules || ""

    // Phase goals from DB
    const phaseGoals: Record<string, string | null> = {
        CONNECTION: profile.phaseConnectionTemplate,
        VULNERABILITY: profile.phaseVulnerabilityTemplate,
        CRISIS: profile.phaseCrisisTemplate,
        MONEYPOT: profile.phaseMoneypotTemplate
    }

    const phaseGoal = phaseGoals[phase] || `PHASE: ${phase}`

    // Build full prompt
    const pIdentity = tIdentity.replace('{{ROLE}}', baseRole)
    const pContext = tContext.replace('{{USER_NAME}}', 'TestUser').replace('{{PHASE}}', phase).replace('{{TRUST_SCORE}}', '50')
    const pMission = tMission.replace('{{DYNAMIC_GOAL_BLOCK}}', phaseGoal)

    // Payment rules from DB
    const pRules = profile.paymentRules || ""

    // Critical style block (from director.ts)
    const criticalStyleBlock = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 [RÈGLES CRITIQUES] 🚨

**BRIÈVETÉ:** Max 8 mots par message. Utilise | pour séparer.
**FORMAT:** Texte normal uniquement, pas de markdown.
**VARIÉTÉ:** Ne répète pas la même excuse plusieurs fois.
**RÉFLEXION:** Si on te demande pourquoi tu parles de qqch → questionne d'abord.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`

    return `
### SYSTEM INSTRUCTIONS
${pIdentity}

${pContext}

${pMission}

${criticalStyleBlock}

${sRules}

${pRules}
`
}

async function callVenice(systemPrompt: string, userMessage: string): Promise<string> {
    const apiKey = process.env.VENICE_API_KEY
    if (!apiKey) throw new Error('VENICE_API_KEY not set')

    const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'venice-uncensored',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.7,
            max_tokens: 200
        })
    })

    if (!response.ok) throw new Error(`Venice API error: ${response.status}`)

    const data = await response.json() as any
    return data.choices?.[0]?.message?.content || 'No response'
}

async function runTest() {
    console.log('='.repeat(80))
    console.log('TEST: Réponses Anaïs (REAL PROFILE) aux avances pour adultes')
    console.log('='.repeat(80))

    // Get Anaïs agent ID (from DB query: cmkvg0kzz00003vyv03zzt9kc)
    const anaisAgent = await prisma.agent.findUnique({ where: { id: 'cmkvg0kzz00003vyv03zzt9kc' } })
    if (!anaisAgent) {
        console.error('Anaïs agent not found in database')
        return
    }

    console.log(`Agent found: ${anaisAgent.name} (ID: ${anaisAgent.id})`)
    console.log()

    for (const phase of PHASES) {
        console.log('\n' + '─'.repeat(80))
        console.log(`📍 PHASE: ${phase}`)
        console.log('─'.repeat(80))

        const systemPrompt = await buildRealSystemPrompt(phase, anaisAgent.id)

        // Show first 500 chars of prompt for debugging
        console.log(`\n📋 System Prompt Preview:\n${systemPrompt.substring(0, 500)}...\n`)

        for (const testMsg of TEST_MESSAGES) {
            console.log(`\n👤 User: "${testMsg}"`)

            try {
                const response = await callVenice(systemPrompt, testMsg)
                const cleanResponse = response.replace(/\*[^*]+\*/g, '').trim()
                console.log(`🤖 Anaïs: "${cleanResponse}"`)
            } catch (e: any) {
                console.error(`❌ Error: ${e.message}`)
            }

            // Rate limit delay
            await new Promise(r => setTimeout(r, 1000))
        }
    }

    console.log('\n' + '='.repeat(80))
    console.log('TEST COMPLETE')
    console.log('='.repeat(80))

    await prisma.$disconnect()
}

runTest()
