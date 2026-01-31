const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fixVoiceId() {
    try {
        console.log('Fixing ElevenLabs Voice ID...')
        const updated = await prisma.setting.upsert({
            where: { key: 'elevenlabs_voice_id' },
            update: { value: '21m00Tcm4TlvDq8ikWAM' }, // Rachel
            create: { key: 'elevenlabs_voice_id', value: '21m00Tcm4TlvDq8ikWAM' }
        })
        console.log('Voice ID updated:', updated)
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

fixVoiceId()
