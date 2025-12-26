const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- UPDATING PROMPT RULES FOR SPLIT MESSAGES ---')
    const setting = await prisma.setting.findUnique({ where: { key: 'prompt_global_rules' } })

    if (setting) {
        let rules = setting.value
        if (!rules.includes('|||')) {
            console.log('Adding splitting rule...')
            rules += `
5. **FORMATTING**:
   - You can send multiple short messages instead of one big block.
   - Use "|||" to separate messages.
   - Example: "wait... ||| i think i know that place! ||| is it near the mall?"
   - This makes you look more real. Use it often.
`
            await prisma.setting.update({
                where: { key: 'prompt_global_rules' },
                data: { value: rules }
            })
            console.log('DONE: Rule added.')
        } else {
            console.log('Rule already exists.')
        }
    } else {
        console.log('ERROR: prompt_global_rules not found.')
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
