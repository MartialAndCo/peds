
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Fetching Style Instructions...")
    const setting = await prisma.setting.findUnique({
        where: { key: 'prompt_style_instructions' }
    })
    console.log("Current Style:\n", setting?.value || "NONE")
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect())
