
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log('Migrating Global Rules (agentId: null) to Agent 1 (agentId: 1)...')

    const result = await prisma.blacklistRule.updateMany({
        where: { agentId: null },
        data: { agentId: 1 }
    })

    console.log(`✅ Migrated ${result.count} rules to Agent 1.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
