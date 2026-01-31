const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Seeding settings...')

    await prisma.setting.upsert({
        where: { key: 'paypal_username' },
        update: {},
        create: {
            key: 'paypal_username',
            value: 'marty_mcfly' // Default placeholder, user should change this
        }
    })

    console.log('Settings seeded.')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
