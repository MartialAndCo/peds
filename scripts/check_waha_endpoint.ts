
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const setting = await prisma.setting.findFirst({
        where: { key: 'waha_endpoint' }
    })
    console.log('WAHA Endpoint Setting:', setting)
}

main().catch(console.error).finally(() => prisma.$disconnect())
