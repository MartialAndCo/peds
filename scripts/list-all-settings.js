const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function listAllSettings() {
    console.log('=== ALL SETTINGS IN DATABASE ===\n')

    const settings = await prisma.setting.findMany({
        orderBy: { key: 'asc' }
    })

    console.log(`Total: ${settings.length} settings\n`)

    for (const s of settings) {
        console.log(`Key: ${s.key}`)
        if (s.value) {
            const preview = s.value.substring(0, 150).replace(/\n/g, ' ')
            console.log(`Value: ${preview}${s.value.length > 150 ? '... (' + s.value.length + ' chars total)' : ''}`)
        } else {
            console.log(`Value: null`)
        }
        console.log('---\n')
    }
}

listAllSettings()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
