const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Forcing WAHA API Key to 'secret'...")
    await prisma.setting.upsert({
        where: { key: 'waha_api_key' },
        create: { key: 'waha_api_key', value: 'secret' },
        update: { value: 'secret' }
    })

    await prisma.setting.upsert({
        where: { key: 'waha_endpoint' },
        create: { key: 'waha_endpoint', value: 'http://localhost:3001' },
        update: { value: 'http://localhost:3001' }
    })
    console.log("Settings updated.")
}

main().catch(console.error).finally(() => prisma.$disconnect())
