import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Updating Agent Timezones...')

    // 1. Update Anaïs to Europe/Paris
    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Anaïs', mode: 'insensitive' } }
    })

    if (anais) {
        console.log(`Found Anaïs (ID: ${anais.id}). Setting timezone to Europe/Paris...`)
        await prisma.agentProfile.upsert({
            where: { agentId: anais.id },
            create: {
                agentId: anais.id,
                timezone: 'Europe/Paris',
                locale: 'fr-FR'
            },
            update: {
                timezone: 'Europe/Paris'
            }
        })
        // Also update settings just in case
        await prisma.agentSetting.upsert({
            where: {
                agentId_key: { agentId: anais.id, key: 'timezone' }
            },
            create: { agentId: anais.id, key: 'timezone', value: 'Europe/Paris' },
            update: { value: 'Europe/Paris' }
        })
        console.log('Anaïs updated.')
    } else {
        console.warn('Anaïs not found.')
    }

    // 2. Update Lena to America/Los_Angeles
    const lena = await prisma.agent.findFirst({
        where: { name: { contains: 'Lena', mode: 'insensitive' } }
    })

    if (lena) {
        console.log(`Found Lena (ID: ${lena.id}). Setting timezone to America/Los_Angeles...`)
        await prisma.agentProfile.upsert({
            where: { agentId: lena.id },
            create: {
                agentId: lena.id,
                timezone: 'America/Los_Angeles',
                locale: 'en-US'
            },
            update: {
                timezone: 'America/Los_Angeles'
            }
        })
        // Also update settings
        await prisma.agentSetting.upsert({
            where: {
                agentId_key: { agentId: lena.id, key: 'timezone' }
            },
            create: { agentId: lena.id, key: 'timezone', value: 'America/Los_Angeles' },
            update: { value: 'America/Los_Angeles' }
        })
        console.log('Lena updated.')
    } else {
        console.warn('Lena not found.')
    }

    console.log('Timezone update complete.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
