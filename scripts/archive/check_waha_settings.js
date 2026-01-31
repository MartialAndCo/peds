const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- CHECKING WAHA SETTINGS ---')
    const settings = await prisma.setting.findMany({
        where: {
            key: { contains: 'waha' }
        }
    })
    if (settings.length === 0) {
        console.log('NO WAHA SETTINGS FOUND - Using defaults?')
    }
    settings.forEach(s => {
        console.log(`${s.key}: ${s.value}`)
    })
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
