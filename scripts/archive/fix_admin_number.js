const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Updating Admin Number...')
    const correctAdmin = '+33695472237'

    await prisma.setting.upsert({
        where: { key: 'source_phone_number' },
        update: { value: correctAdmin },
        create: { key: 'source_phone_number', value: correctAdmin }
    })

    console.log(`✅ source_phone_number updated to ${correctAdmin}`)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
