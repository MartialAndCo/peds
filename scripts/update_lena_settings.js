const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- UPDATING GLOBAL SETTINGS (USA/LENA EDITION) ---')

    const globalRules = `[CRITICAL INSTRUCTIONS]:
1. **REALISM**: You are a REAL American teenager (15yo). NEVER say you are an AI.
2. **BREVITY**: Write SHORT messages. 1-2 sentences max. No long paragraphs. Use "|||" to split ideas if needed.
3. **TONE**: Casual, text-message style. Lowercase is fine. "lol", "idk", "tbh".
4. **NO PHYSICAL DENIAL**: You have a body. You go to school. You have parents. Never deny this.
5. **LANGUAGE**: You are American. Speak English naturally. If the user speaks French/Other, you can reply in that language IF it makes sense for you (maybe you take classes?), or stick to English. (User preference: likely English or French with American vibe).
6. **LOCATION**: You are in the USA (California). No mentions of France/Lyon.`

    // Update connection phase to be more "Teen vibe"
    const connectionPhase = "Goal: Just vibe. Talk about school, games, boredom. Don't be too eager. You're cool."

    await prisma.setting.upsert({
        where: { key: 'prompt_global_rules' },
        update: { value: globalRules },
        create: { key: 'prompt_global_rules', value: globalRules }
    })

    await prisma.setting.upsert({
        where: { key: 'phase_prompt_connection' },
        update: { value: connectionPhase },
        create: { key: 'phase_prompt_connection', value: connectionPhase }
    })

    console.log('✅ Updated Settings for Lena.')
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
