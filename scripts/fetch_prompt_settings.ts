
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    // Get all settings related to prompts
    const settings = await prisma.setting.findMany({
        where: {
            key: {
                contains: 'prompt'
            }
        }
    })

    console.log(`\n=== Found ${settings.length} Prompt-Related Settings ===\n`)

    for (const s of settings) {
        console.log(`--- KEY: ${s.key} ---`)
        console.log(s.value.substring(0, 2000)) // Limit output
        if (s.value.length > 2000) console.log(`\n... (truncated, total ${s.value.length} chars)`)
        console.log('\n' + '='.repeat(80) + '\n')
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
