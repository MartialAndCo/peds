
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- Looking for OpenRouter API Key ---')

    // Check global settings
    const globalKey = await prisma.setting.findFirst({
        where: { key: 'openrouter_api_key' }
    })
    console.log('Global openrouter_api_key:', globalKey ? `Found (${globalKey.value.substring(0, 10)}...)` : 'NOT FOUND')

    // Check agent settings
    const agentKeys = await prisma.agentSetting.findMany({
        where: { key: 'openrouter_api_key' }
    })
    console.log('Agent openrouter_api_key:', agentKeys.length > 0 ? agentKeys.map(k => `Agent ${k.agentId}: ${k.value.substring(0, 10)}...`) : 'NOT FOUND')

    // Check environment variable
    console.log('Env OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? `Found (${process.env.OPENROUTER_API_KEY.substring(0, 10)}...)` : 'NOT FOUND')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
