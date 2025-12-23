const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Updating System Prompt for Voice Compatibility...")

    // Find the default prompt (or all active prompts)
    const prompts = await prisma.prompt.findMany()

    for (const prompt of prompts) {
        if (!prompt.system_prompt.includes('Voice Message Transcribed')) {
            console.log(`Patching prompt: ${prompt.name}`)
            const newInstruction = `
\n[IMPORTANT]
If you receive a message beginning with "[Voice Message Transcribed]:", IT IS A VOICE MESSAGE from the user that has been converted to text for you.
DO NOT say "I cannot hear" or "I am not equipped".
Simply REPLY CONVERSATIONALLY to the content of the transcription.
Your reply will be converted back to audio for the user.`

            await prisma.prompt.update({
                where: { id: prompt.id },
                data: {
                    system_prompt: prompt.system_prompt + newInstruction
                }
            })
            console.log("Prompt updated.")
        } else {
            console.log(`Prompt ${prompt.name} already has voice instructions.`)
        }
    }

    // Also ensure Voice settings are ON
    const voiceSetting = await prisma.setting.findUnique({ where: { key: 'voice_response_enabled' } })
    if (!voiceSetting || voiceSetting.value !== 'true') {
        console.log("Enabling Voice Response Setting...")
        await prisma.setting.upsert({
            where: { key: 'voice_response_enabled' },
            create: { key: 'voice_response_enabled', value: 'true' },
            update: { value: 'true' }
        })
    }
    console.log("Voice Response Setting is ON.")
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
