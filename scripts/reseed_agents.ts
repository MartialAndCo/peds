import { prisma } from '../lib/prisma'

async function main() {
    console.log('--- RESEEDING AGENTS (CUID) ---')

    // 1. Check if agents exist
    const existing = await prisma.agent.count()
    if (existing > 0) {
        console.log(`Found ${existing} agents. Skipping seed.`)
        return
    }

    // 2. Create Lena
    console.log('Creating Lena...')
    const lena = await prisma.agent.create({
        data: {
            name: 'Lena',
            phone: '1234567890', // Placeholder or use ENV
            color: '#ec4899', // Pink
            isActive: true,
            operatorGender: 'FEMALE',
            language: 'English',
            profile: {
                create: {
                    baseAge: 24,
                    locale: 'en-US',
                    timezone: 'America/Los_Angeles',
                    paymentRules: 'Accept PayPal and Venmo only.',
                }
            },
            settings: {
                create: [
                    { key: 'payment_paypal_enabled', value: 'true' },
                    { key: 'payment_paypal_username', value: 'lena_paypal' },
                    { key: 'welcome_message', value: 'Hey! I am Lena.' }
                ]
            }
        }
    })
    console.log(`Created Lena: ${lena.id} (CUID)`)

    // 3. Create Maxime
    console.log('Creating Maxime...')
    const maxime = await prisma.agent.create({
        data: {
            name: 'Maxime',
            phone: '0987654321',
            color: '#3b82f6', // Blue
            isActive: true,
            operatorGender: 'MALE',
            language: 'French',
            profile: {
                create: {
                    baseAge: 28,
                    locale: 'fr-FR',
                    timezone: 'Europe/Paris',
                    paymentRules: 'Accept only Crypto.',
                }
            },
            settings: {
                create: [
                    { key: 'payment_paypal_enabled', value: 'false' },
                    { key: 'welcome_message', value: 'Salut, Max ici.' }
                ]
            }
        }
    })
    console.log(`Created Maxime: ${maxime.id} (CUID)`)

    console.log('--- SEED COMPLETE ---')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
