const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- CHECKING SETTINGS ---')
    const settings = await prisma.setting.findMany()
    settings.forEach(s => {
        console.log(`${s.key}: ${s.value}`)
    })
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
