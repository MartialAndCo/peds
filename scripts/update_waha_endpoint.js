const { PrismaClient } = require('@prisma/client')

async function main() {
    const prisma = new PrismaClient()

    const newEndpoint = 'http://13.60.16.81:3001'

    console.log('Updating waha_endpoint to:', newEndpoint)

    await prisma.setting.upsert({
        where: { key: 'waha_endpoint' },
        update: { value: newEndpoint },
        create: { key: 'waha_endpoint', value: newEndpoint }
    })

    // Verify
    const check = await prisma.setting.findUnique({ where: { key: 'waha_endpoint' } })
    console.log('Updated! New value:', check?.value)

    await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
