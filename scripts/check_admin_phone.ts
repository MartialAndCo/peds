
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const setting = await prisma.setting.findFirst({
        where: { key: 'source_phone_number' }
    })
    console.log('Admin Phone Setting:', setting)

    // Check Agent Settings too just in case
    const agentSettings = await prisma.agentSetting.findMany({
        where: { key: 'source_phone_number' }
    })
    console.log('Agent Overrides:', agentSettings)
}

main().catch(console.error).finally(() => prisma.$disconnect())
