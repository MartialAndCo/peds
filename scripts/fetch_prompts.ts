
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    // Get all active prompts
    const prompts = await prisma.prompt.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' }
    })

    console.log(`\n=== Found ${prompts.length} Active Prompts ===\n`)

    for (const p of prompts) {
        console.log(`--- PROMPT ID: ${p.id} | NAME: ${p.name} ---`)
        console.log(p.system_prompt)
        console.log('\n' + '='.repeat(80) + '\n')
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
