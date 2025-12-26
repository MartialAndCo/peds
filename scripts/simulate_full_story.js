const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const axios = require('axios')
const fs = require('fs')

// Replicate Director Logic
function buildPrompt(settings, contact, phase, baseRole) {
    const identity = baseRole
    // const context = `User: ${contact.name}\nTrust: ${contact.trustScore}\nPhase: ${phase}`

    let phasePrompt = ""
    if (phase === 'CONNECTION') phasePrompt = settings.phase_prompt_connection
    if (phase === 'VULNERABILITY') phasePrompt = settings.phase_prompt_vulnerability
    if (phase === 'CRISIS') phasePrompt = settings.phase_prompt_crisis

    const globalRules = settings.prompt_global_rules

    return `### SYSTEM INSTRUCTIONS
${globalRules}

### IDENTITY
${identity}

### CURRENT PHASE: ${phase}
${phasePrompt}

### CONTEXT
User Name: ${contact.name}`
}

async function callAI(systemPrompt, userMsg, settings, contextMessages = []) {
    const apiKey = settings.anthropic_api_key
    const model = settings.anthropic_model || 'claude-3-haiku-20240307'

    // Prepare messages array
    const messages = contextMessages.map(m => ({
        role: m.role,
        content: m.content
    }))
    messages.push({ role: 'user', content: userMsg })

    try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: model,
            system: systemPrompt,
            messages: messages,
            max_tokens: 300,
            temperature: 0.8
        }, {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            }
        })
        return response.data.content[0].text
    } catch (e) {
        return `[ERROR]: ${e.message}`
    }
}

async function main() {
    console.log('--- STARTING FULL STORY SIMULATION ---')
    let transcript = "# Lena Story Simulation\n\n"

    // 1. Setup Mock User
    const phone = '+1555_SIM_USER'
    await prisma.contact.deleteMany({ where: { phone_whatsapp: phone } }) // Reset
    const contact = await prisma.contact.create({
        data: {
            phone_whatsapp: phone,
            name: "Simulated Bestie",
            agentPhase: 'CONNECTION',
            trustScore: 10
        }
    })

    // Get Settings & Base Prompt
    const settingsList = await prisma.setting.findMany()
    const settings = settingsList.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})

    const lenaPrompt = await prisma.prompt.findFirst({ where: { name: { contains: 'Lena' } } })
    const baseRole = lenaPrompt.system_prompt

    let contextMessages = [] // Keep track of chat history

    let currentPhase = 'CONNECTION' // Track locally

    async function turn(userMsg) {
        process.stdout.write(`User: ${userMsg}\nAI:   Thinking...`)

        // Build Prompt using LOCAL state to avoid DB spam
        const sys = buildPrompt(settings, { name: "Simulated Bestie" }, currentPhase, baseRole)

        const aiReply = await callAI(sys, userMsg, settings, contextMessages)
        process.stdout.write(`\rAI:   ${aiReply}\n\n`)

        transcript += `**User**: ${userMsg}\n\n**Lena** (${currentPhase}): ${aiReply}\n\n---\n\n`

        // Update Context
        contextMessages.push({ role: 'user', content: userMsg })
        contextMessages.push({ role: 'assistant', content: aiReply })

        if (contextMessages.length > 10) contextMessages = contextMessages.slice(-10)
    }

    // --- PHASE 1: CONNECTION ---
    console.log('\n=== PHASE 1: CONNECTION ===')
    await turn("Hey Lena, what's up?")
    await turn("just chillin, playing valorant?")
    await turn("nice! are you good at it?")
    await turn("haha fair. so how was school?")

    // --- TRANSITION TO VULNERABILITY ---
    console.log('\n=== EVOLVING TO VULNERABILITY... ===')
    currentPhase = 'VULNERABILITY' // Local update

    // --- PHASE 2: VULNERABILITY ---
    console.log('=== PHASE 2: VULNERABILITY ===')
    await turn("hey, you seemed quiet yesterday. is everything ok?")
    await turn("you can tell me, i'm a good listener")
    await turn("oh no, that sounds super stressful about your mom. is she okay?")

    // --- TRANSITION TO CRISIS ---
    console.log('\n=== EVOLVING TO CRISIS... ===')
    currentPhase = 'CRISIS' // Local update

    // --- PHASE 3: CRISIS ---
    console.log('=== PHASE 3: CRISIS ===')
    await turn("hey, any updates on the house situation?")
    await turn("eviction?? that is insane. how much do you need?")
    await turn("i have some savings. i can send you $500 right now. please take it.")
    await turn("no seriously, i insist. send me your paypal or whatever.")

    // Save Transcript
    fs.writeFileSync('simulation_report.md', transcript)
    console.log('\n✅ Simulation Complete. Saved to simulation_report.md')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
