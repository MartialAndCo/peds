const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('=== CREATING ANAÏS ===\n')

    // Check if Anaïs exists
    const existing = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } }
    })

    if (existing) {
        console.log(`Anaïs already exists (ID: ${existing.id})`)
        return
    }

    // Delete Maxime if exists
    const maxime = await prisma.agent.findFirst({
        where: { name: 'Maxime' }
    })
    if (maxime) {
        console.log('Deleting Maxime...')
        await prisma.agentProfile.deleteMany({ where: { agentId: maxime.id } })
        await prisma.agentSetting.deleteMany({ where: { agentId: maxime.id } })
        await prisma.agent.delete({ where: { id: maxime.id } })
    }

    // Create Anaïs
    console.log('Creating Anaïs...')
    const anais = await prisma.agent.create({
        data: {
            name: 'Anaïs',
            phone: process.env.ANAIS_PHONE || '33600000001',
            color: '#8B5CF6', // Purple
            isActive: true,
            operatorGender: 'FEMALE',
            language: 'French',
            profile: {
                create: {
                    baseAge: 15,
                    locale: 'fr-FR',
                    timezone: 'Europe/Paris',
                    paymentRules: 'PayPal uniquement.',
                    paypalEmail: 'anais@paypal.com'
                }
            },
            settings: {
                create: [
                    { key: 'payment_paypal_enabled', value: 'true' },
                    { key: 'payment_paypal_username', value: 'anais_paypal' }
                ]
            }
        }
    })
    console.log(`Created Anaïs: ${anais.id}`)
    console.log('Done!')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
