
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- Checking Global Settings ---')
    const globalSettings = await prisma.setting.findMany({
        where: { key: { contains: 'ai_' } }
    })
    console.log('Global Settings:', globalSettings)

    console.log('\n--- Checking Agent Settings ---')
    const agentSettings = await prisma.agentSetting.findMany({
        where: { key: { contains: 'ai_' } }
    })
    console.log('Agent Settings:', agentSettings)

    // FORCE UPDATE to OpenRouter if set to Venice
    /* 
    console.log('\n--- Updating to OpenRouter ---')
    await prisma.agentSetting.updateMany({
        where: { key: 'ai_provider', value: 'venice' },
        data: { value: 'openrouter' }
    })
    console.log('Updated Agent Settings to OpenRouter')
    */
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
