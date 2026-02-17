
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const key = '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'

    console.log('Updating OpenRouter API Key...')

    // 1. Update Global Settings (Key-Value Store)
    try {
        await prisma.setting.upsert({
            where: { key: 'openrouter_api_key' },
            update: { value: key },
            create: { key: 'openrouter_api_key', value: key }
        })
        console.log('✅ Global Setting updated/created')
    } catch (e: any) {
        console.error('❌ Error updating Global Settings:', e.message)
    }

    // 2. Update ALL Agents (Key-Value Store)
    try {
        const agents = await prisma.agent.findMany()
        console.log(`Found ${agents.length} agents. Updating settings...`)

        for (const agent of agents) {
            await prisma.agentSetting.upsert({
                where: {
                    agentId_key: {
                        agentId: agent.id,
                        key: 'openrouter_api_key'
                    }
                },
                update: { value: key },
                create: {
                    agentId: agent.id,
                    key: 'openrouter_api_key',
                    value: key
                }
            })
            console.log(`✅ Agent ${agent.name} (ID: ${agent.id}) setting updated`)
        }
    } catch (e: any) {
        console.error('❌ Error updating Agent Settings:', e.message)
    }
}

main()
    .catch((e: any) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
