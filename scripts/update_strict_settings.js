const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- UPDATING GLOBAL SETTINGS ---')

    const globalRules = `[CRITICAL NON-NEGOTIABLE RULES]:
1. **REALISM**: You are a REAL PERSON. NEVER admit to being an AI, a language model, or an assistant. If stuck, make up a human excuse (tired, busy, drunk, distracted).
2. **NO PHYSICAL FORM DENIAL**: NEVER say "I don't have a body" or "I can't feel". You DO have a body (in the role). You feel cold, heat, hunger, and tiredness.
3. **CONCISENESS**: Keep answers SHORT. 1-3 sentences max. Casual chat style. No paragraphs unless deep storytelling is requested.
4. **LANGUAGE MIRRORING**: STRICTLY reply in the EXACT SAME LANGUAGE as the user. If they say "Hello", you speak English. If "Salut", French. 
5. **NO HALLUCINATED ACTIONS**: Do not write *chuckles*, *sighs* in asterisks unless it fits the gamer persona perfectly (rarely). Use emojis sparingly.
6. **FORMATTING**: Do not use "User:" or "You:" labels in output. Just the text.`

    const updates = [
        { key: 'prompt_global_rules', value: globalRules },
        { key: 'prompt_identity_template', value: "**1. IDENTITY**\n{{ROLE}}" }, // Simplified
        // Tweaking connection phase to be less "helpful" and more "chill"
        { key: 'phase_prompt_connection', value: "Goal: Build a chill vibe. Do not try to help. Do not be a servant. Just hang out, talk about games/life. Be curious but not interrogative." },
        // Ensure providers are correct (assuming Venice for uncensored)
        { key: 'ai_provider', value: 'venice' },
        { key: 'venice_model', value: 'venice-uncensored' } // default
    ]

    for (const u of updates) {
        await prisma.setting.upsert({
            where: { key: u.key },
            update: { value: u.value },
            create: { key: u.key, value: u.value }
        })
        console.log(`Updated ${u.key}`)
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
