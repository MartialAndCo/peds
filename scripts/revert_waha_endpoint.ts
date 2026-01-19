
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const originalIp = 'http://13.60.16.81:3001'
    console.log(`REVERTING waha_endpoint to ${originalIp}...`)

    await prisma.setting.update({
        where: { key: 'waha_endpoint' },
        data: { value: originalIp }
    })

    console.log('Revert complete.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
