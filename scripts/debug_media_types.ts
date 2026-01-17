
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Fetching MediaTypes...")
    const types = await prisma.mediaType.findMany()
    console.log("Found", types.length, "types.")

    types.forEach(t => {
        console.log(`ID: ${t.id}`)
        console.log(`Description: "${t.description}"`)
        console.log(`Keywords: ${t.keywords.join(', ')}`)
        console.log("---")
    })
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect())
