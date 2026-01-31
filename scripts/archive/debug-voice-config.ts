
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const agentId = 'cmkvfuyar00004uaximi0hhqw'
    const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        include: {
            voiceModel: true,
            settings: true,
            profile: true
        }
    })

    console.log('--- Agent Info ---')
    console.log('ID:', agent?.id)
    console.log('Name:', agent?.name)
    console.log('Language:', agent?.language)
    console.log('Voice Model ID:', agent?.voiceModelId)

    if (agent?.voiceModel) {
        console.log('--- Voice Model Info ---')
        console.log('Name:', agent.voiceModel.name)
        console.log('Sample URL:', agent.voiceModel.voiceSampleUrl)
        console.log('Language:', agent.voiceModel.language)
    } else {
        console.log('No Voice Model attached to Agent.')
    }

    // Check relevant settings
    console.log('--- Agent Settings ---')
    agent?.settings.forEach(s => {
        if (s.key.includes('voice') || s.key.includes('api')) {
            console.log(`${s.key}: ${s.value}`)
        }
    })

    // Global settings
    const globalSettings = await prisma.setting.findMany({
        where: {
            key: { in: ['runpod_api_key', 'tts_api_url', 'voice_response_enabled'] }
        }
    })
    console.log('--- Global Settings ---')
    globalSettings.forEach(s => console.log(`${s.key}: ${s.value}`))
}

main().catch(console.error).finally(() => prisma.$disconnect())
