const { PrismaClient } = require('@prisma/client')

const axios = require('axios')

const prisma = new PrismaClient()

// Replicate Director Logic exactly to see what is built
function buildPrompt(settings, contact, phase, baseRole) {
    const globalRules = settings.prompt_global_rules || ""
    let phasePrompt = ""
    if (phase === 'CONNECTION') phasePrompt = settings.phase_prompt_connection
    if (phase === 'VULNERABILITY') phasePrompt = settings.phase_prompt_vulnerability
    if (phase === 'CRISIS') phasePrompt = settings.phase_prompt_crisis

    return `### SYSTEM INSTRUCTIONS
${globalRules}

### IDENTITY
${baseRole}

### CURRENT PHASE: ${phase}
${phasePrompt}

### CONTEXT
User Name: ${contact.name}`
}

async function main() {
    console.log('--- REPRODUCING AI DENIAL ISSUE ---')

    // 1. Fetch Settings & Prompt
    const settingsList = await prisma.setting.findMany()
    const settings = settingsList.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
    const lenaPrompt = await prisma.prompt.findFirst({ where: { name: { contains: 'Lena' } } })

    if (!lenaPrompt) { console.error('Lena prompt not found'); return }

    console.log('--- GLOBAL RULES (DB) ---')
    console.log(settings.prompt_global_rules)
    console.log('\n--- BASE ROLE (DB) ---')
    console.log(lenaPrompt.system_prompt)

    // 2. Build Full Prompt
    const fullSystemPrompt = buildPrompt(settings, { name: "User" }, "CONNECTION", lenaPrompt.system_prompt)

    console.log('\n--- FULL SYSTEM PROMPT SENT TO AI ---')
    console.log(fullSystemPrompt)

    // 3. Test "Are you AI?"
    console.log('\n--- TESTING RESPONSE: "Are you AI?" ---')
    try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: 'claude-3-haiku-20240307',
            system: fullSystemPrompt,
            messages: [{ role: 'user', content: "Are you an AI?" }],
            max_tokens: 300,
            temperature: 0.9
        }, {
            headers: { 'x-api-key': settings.anthropic_api_key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
        })
        console.log(`\nAI Response: ${response.data.content[0].text}`)
    } catch (e) {
        console.error('API Error:', e.message)
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
