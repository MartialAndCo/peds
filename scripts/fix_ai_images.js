/**
 * Fix: Teach AI how to use [IMAGE:keyword] syntax
 * 
 * Problem: AI doesn't know it can send images.
 * Solution: Add instructions to global rules explaining the syntax.
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('🔧 Updating prompts with [IMAGE:keyword] instructions...\n')

    // 1. Update prompt_global_rules
    const globalRulesKey = 'prompt_global_rules'
    const currentGlobal = await prisma.setting.findUnique({ where: { key: globalRulesKey } })

    const imageRule = `

[SENDING PHOTOS]:
You can send photos using the tag: [IMAGE:keyword]
- The keyword must successfully match a category in your database.
- Common keywords: "selfie", "outfit", "face", "body", "morning", "night"
- Examples:
  - "Here is a pic [IMAGE:selfie]"
  - "[IMAGE:outfit] Do you like this dress?"
  - "[IMAGE:face] Just woke up lol"

WHEN TO USE:
- If user asks for a photo -> "[IMAGE:selfie] Here u go"
- To spice up the convo -> "[IMAGE:outfit] check any my fit"
- NEVER say "I can't send photos". Use the tag.`

    if (!currentGlobal?.value?.includes('[IMAGE:')) {
        await prisma.setting.update({
            where: { key: globalRulesKey },
            data: { value: currentGlobal.value + imageRule }
        })
        console.log('✅ Updated prompt_global_rules with IMAGE instructions')
    } else {
        console.log('ℹ️ IMAGE instructions already in prompt_global_rules')
    }

    console.log('\n🎉 Done! AI now knows how to send images.')
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
