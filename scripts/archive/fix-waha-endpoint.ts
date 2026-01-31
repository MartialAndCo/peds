
import { prisma } from '../lib/prisma'

async function main() {
    console.log('🔍 Checking WAHA Configuration...')

    const settings = await prisma.setting.findMany({
        where: { key: { in: ['waha_endpoint', 'waha_api_key', 'waha_session'] } }
    })

    console.log('\nCurrent Settings in DB:')
    settings.forEach(s => {
        console.log(`- ${s.key}: ${s.value}`)
    })

    const newEndpoint = 'http://13.60.16.81:3001' // User confirmed this IP, port 3001 seems open
    // Note: If WAHA is on 3001, change to 3001.

    console.log(`\n📝 Updating waha_endpoint to: ${newEndpoint}`)

    await prisma.setting.upsert({
        where: { key: 'waha_endpoint' },
        update: { value: newEndpoint },
        create: { key: 'waha_endpoint', value: newEndpoint }
    })

    console.log('✅ Update complete.')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
