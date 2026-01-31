
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    // Get ALL settings (full dump)
    const settings = await prisma.setting.findMany({
        orderBy: { key: 'asc' }
    })

    console.log(`\n=== Found ${settings.length} Total Settings ===\n`)

    for (const s of settings) {
        console.log(`\n${'#'.repeat(80)}`)
        console.log(`# KEY: ${s.key}`)
        console.log(`${'#'.repeat(80)}`)
        console.log(s.value)
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
