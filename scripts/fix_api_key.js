const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Updating waha_api_key to 'secret'...")
    const result = await prisma.setting.upsert({
        where: { key: 'waha_api_key' },
        update: { value: 'secret' },
        create: { key: 'waha_api_key', value: 'secret' }
    })
    console.log("Updated:", result)
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
