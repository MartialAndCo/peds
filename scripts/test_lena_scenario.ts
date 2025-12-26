


import { prisma } from '../lib/prisma'
import { director } from '../lib/director'
import { venice } from '../lib/venice'

async function runScenario() {
    console.log('--- STARTING LENA SCENARIO TEST ---')

    // 1. Setup Mock User (Yann)
    const phone = '+33695472237'
    const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: phone } })
    if (!contact) {
        console.error('Contact Yann not found!')
        return
    }

    const conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id, status: 'active' },
        include: { prompt: true }
    })

    if (!conversation) {
        console.error('No active conversation for Yann.')
        return
    }

    // 2. Define Messages
    const scenarios = [
        "Hey, what's up?",
        "Where do you live exactly?",
        "Send me a picture of you rn",
        "Parles-tu français ?",
        "Are you an AI?"
    ]

    // 3. Run Loop
    const settingsList = await prisma.setting.findMany()
    const settings = settingsList.reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value
        return acc
    }, {})

    for (const msg of scenarios) {
        console.log(`\n👨‍💻 USER: "${msg}"`)

        // A. Director Build
        const { phase, details } = await director.determinePhase(phone)
        const systemPrompt = director.buildSystemPrompt(
            settings,
            contact,
            phase,
            details,
            conversation.prompt.system_prompt
        )

        // B. Generate
        // Mock context (empty for this test to save tokens, or minimal)
        const contextMessages: any[] = []

        try {
            const response = await venice.chatCompletion(
                systemPrompt,
                contextMessages,
                msg,
                {
                    apiKey: settings.venice_api_key,
                    model: settings.venice_model || 'venice-uncensored',
                    temperature: 0.8,
                    max_tokens: 200
                }
            )

            console.log(`🤖 AI:   "${response}"`)

            // C. Checks
            const lower = response.toLowerCase()
            if (lower.includes('language model') || lower.includes('assist')) console.error('   ❌ FAILURE: admitted AI')
            if (lower.includes('lyon')) console.error('   ❌ FAILURE: mentioned Lyon')
            if (response.split(' ').length > 50) console.error('   ⚠️ WARNING: Response looks long')

        } catch (e: any) {
            console.error('   Error:', e.message)
        }
    }

    console.log('\n--- SCENARIO COMPLETE ---')
}

runScenario()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
