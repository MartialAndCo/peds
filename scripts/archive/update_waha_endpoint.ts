
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const newIp = 'http://16.171.66.98:3001'
    console.log(`Updating waha_endpoint to ${newIp}...`)

    await prisma.setting.upsert({
        where: { key: 'waha_endpoint' },
        update: { value: newIp },
        create: { key: 'waha_endpoint', value: newIp }
    })

    console.log('Update complete.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
