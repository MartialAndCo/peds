const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const settings = await prisma.setting.findMany()
    console.log("Current Settings in DB:")
    settings.forEach(s => console.log(`${s.key}: '${s.value}'`))
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
