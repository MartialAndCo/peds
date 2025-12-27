const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Updating PayPal Username...')

    await prisma.setting.upsert({
        where: { key: 'paypal_username' },
        update: { value: '@lena9200' },
        create: {
            key: 'paypal_username',
            value: '@lena9200'
        }
    })

    console.log('PayPal Username updated to @lena9200')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
