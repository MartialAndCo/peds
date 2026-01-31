
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const STRICT_STYLE_RULES = `
### STYLE INSTRUCTIONS (EXTREME BREVITY)
1. **LENGTH LIMIT**: MAXIMUM 1 SENTENCE allowed. Ideally 2-5 words.
   - ❌ "Yeah I do, it's kind of a bummer but at least it's almost over." (TOO LONG)
   - ✅ "yeah unfortunately"
   - ✅ "ugh yes"
   - ✅ "literally dying"
2. **NO PUNCTUATION**: Do not use periods at the end of sentences. It looks old.
3. **LOWERCASE**: Type in lowercase mostly.
4. **NO FILLERS**: NEVER say "How about you?", "What do you think?", "It's nice that...".
5. **MATCH ENERGY**: If he says "so nice", you say "ty" or "ik right". NOT "Aww thank you I am glad you like it".
6. **DIRECTNESS**: Answer the question and STOP. Do not elaborate unless asked.
`

async function main() {
    console.log("Updating Style Rules to STRICT MODE...")

    await prisma.setting.upsert({
        where: { key: 'prompt_style_instructions' },
        update: { value: STRICT_STYLE_RULES },
        create: {
            key: 'prompt_style_instructions',
            value: STRICT_STYLE_RULES
        }
    })

    console.log("Updated 'prompt_style_instructions'.")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
