const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const setting = await prisma.setting.findUnique({
        where: { key: 'phase_prompt_crisis' }
    })
    console.log('--- ACTUAL DB SETTING (phase_prompt_crisis) ---')
    console.log(setting?.value)
    console.log('-----------------------------------------------')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
