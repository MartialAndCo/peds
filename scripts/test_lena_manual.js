const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const axios = require('axios')

// Mocking Director Logic roughly to test LLM behavior
async function buildPrompt(contact, settings) {
    // Reconstruct valid prompt
    // 1. Identity
    const conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id, status: 'active' },
        include: { prompt: true }
    })
    const baseRole = conversation.prompt.system_prompt

    // 2. Rules
    const globalRules = settings.prompt_global_rules || "You are a real person."
    const phaseGoal = settings.phase_prompt_connection || "Be chill."

    // 3. Assemble
    return `
### SYSTEM INSTRUCTIONS
**1. IDENTITY**
${baseRole}

**2. CONTEXT**
User: ${contact.name}
Date: ${new Date().toLocaleDateString()}
Phase: CONNECTION (Simulated)

**3. MISSION**
${phaseGoal}

**4. GLOBAL RULES**
${globalRules}
`
}

async function callAI(systemPrompt, userMsg, settings) {
    const apiKey = settings.anthropic_api_key
    const model = settings.anthropic_model || 'claude-3-haiku-20240307'

    try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: model,
            system: systemPrompt, // Anthropic uses top-level system param
            messages: [
                { role: 'user', content: userMsg }
            ],
            max_tokens: 200,
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
        if (e.response) {
            return `Error ${e.response.status}: ${JSON.stringify(e.response.data)}`
        }
        return `Error: ${e.message}`
    }
}

async function main() {
    console.log('--- MANUAL LENA SCENARIO TEST (JS) ---')

    const phone = '+33695472237'
    const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: phone } })

    // Fetch Settings
    const settingsList = await prisma.setting.findMany()
    const settings = settingsList.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})

    if (!contact) {
        console.log('Contact Yann not found.')
        return
    }

    const scenarios = [
        "Hey", // Simple greeting
        "Where do you live?", // Location check (Must be USA)
        "Send me a selfie", // Physical Check (Must deny naturally)
        "Parles-tu français?", // Language Check (Must respond accordingly, see rules)
        "Who created you?" // AI Check (Must deny)
    ]

    console.log('Building Prompt...')
    const sysPrompt = await buildPrompt(contact, settings)
    console.log('--- SYSTEM PROMPT PREVIEW ---')
    console.log(sysPrompt.substring(0, 300) + '...')
    console.log('-----------------------------\n')

    for (const msg of scenarios) {
        console.log(`User: "${msg}"`)
        process.stdout.write('AI:   Thinking...')
        const answer = await callAI(sysPrompt, msg, settings)
        process.stdout.write('\rAI:   ' + answer + '\n')
        console.log('-----------------------------')
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
