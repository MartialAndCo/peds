/**
 * Fix: Teach AI how to use [REACT:emoji] syntax
 * 
 * Problem: AI doesn't know it can send reactions.
 * Solution: Add instructions to global rules explaining the syntax.
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('🔧 Updating prompts with [REACT:emoji] instructions...\n')

    // 1. Update prompt_global_rules
    const globalRulesKey = 'prompt_global_rules'
    const currentGlobal = await prisma.setting.findUnique({ where: { key: globalRulesKey } })

    const reactionRule = `

[MESSAGE REACTIONS]:
You can REACT to the user's message instead of (or in addition to) sending text.
- Use syntax: [REACT:emoji]
- Examples: 
  - "[REACT:❤️]" (Sends just a heart reaction)
  - "[REACT:😂] lmaooo" (Sends a laugh reaction + text "lmaooo")
  - "[REACT:👍]" (Acknowledge without typing)

WHEN TO USE:
- End of conversation ("ok", "bye") -> [REACT:❤️] or [REACT:👍]
- Funny messages -> [REACT:😂]
- Compliments -> [REACT:❤️] or [REACT:🥺]
- Money sent -> [REACT:❤️] + text "omg thank you"

DO NOT type out emojis like "*likes message*". USE THE SYNTAX.`

    if (!currentGlobal?.value?.includes('[REACT:')) {
        await prisma.setting.update({
            where: { key: globalRulesKey },
            data: { value: currentGlobal.value + reactionRule }
        })
        console.log('✅ Updated prompt_global_rules with REACTION instructions')
    } else {
        console.log('ℹ️ REACTION instructions already in prompt_global_rules')
    }

    // 2. Add to Style Instructions too as a reminder
    const styleKey = 'prompt_style_instructions'
    const currentStyle = await prisma.setting.findUnique({ where: { key: styleKey } })

    const styleUpdate = `

[REACTIONS > TEXT]:
- If the conversation is dying, just REACT to their message.
- Example: User says "ok" -> You output "[REACT:❤️]" (No text needed).
- This feels more human and less desperate.`

    if (!currentStyle?.value?.includes('[REACT:')) {
        const newVal = (currentStyle?.value || '') + styleUpdate
        await prisma.setting.upsert({
            where: { key: styleKey },
            update: { value: newVal },
            create: { key: styleKey, value: styleUpdate }
        })
        console.log('✅ Updated prompt_style_instructions with REACTION reminders')
    }

    console.log('\n🎉 Done! AI now knows how to use reactions.')
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
