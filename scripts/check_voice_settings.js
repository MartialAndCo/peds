const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkSettings() {
    try {
        const settings = await prisma.setting.findMany()
        const voiceEnabled = settings.find(s => s.key === 'voice_response_enabled')
        const elevenLabsKey = settings.find(s => s.key === 'elevenlabs_api_key')

        console.log('--- Settings Check ---')
        console.log('voice_response_enabled:', voiceEnabled ? voiceEnabled.value : 'NOT SET')
        console.log('elevenlabs_api_key:', elevenLabsKey ? (elevenLabsKey.value ? 'SET' : 'EMPTY') : 'NOT SET')

    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

checkSettings()
