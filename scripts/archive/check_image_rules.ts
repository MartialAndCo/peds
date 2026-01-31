
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Fetching Image Rules...")
    const setting = await prisma.setting.findUnique({
        where: { key: 'prompt_image_handling_rules' }
    })
    console.log("Current Rules:\n", setting?.value || "NONE")
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect())
