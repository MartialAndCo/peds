/**
 * Script pour corriger le port WAHA_ENDPOINT de 3000 vers 3001
 * Le serveur Baileys tourne sur le port 3001, pas 3000
 */

import { prisma } from '../lib/prisma'

async function main() {
    console.log('🔧 Fixing WAHA_ENDPOINT port from 3000 to 3001...\n')

    // 1. Check current value
    const current = await prisma.setting.findUnique({
        where: { key: 'waha_endpoint' }
    })

    console.log('Current waha_endpoint:', current?.value || 'NOT SET')

    // 2. Determine correct endpoint
    let newEndpoint: string
    
    if (!current?.value) {
        // If not set, use default
        newEndpoint = 'http://13.60.16.81:3001'
    } else if (current.value.includes(':3000')) {
        // Replace 3000 with 3001
        newEndpoint = current.value.replace(':3000', ':3001')
    } else if (current.value === 'http://13.60.16.81' || current.value === 'https://13.60.16.81') {
        // Add port if missing
        newEndpoint = 'http://13.60.16.81:3001'
    } else if (current.value.includes('13.60.16.81') && !current.value.includes(':3001')) {
        // Force port 3001 for production IP
        newEndpoint = 'http://13.60.16.81:3001'
    } else {
        console.log('✅ Endpoint already correct or not using port 3000')
        console.log('   Value:', current.value)
        process.exit(0)
    }

    console.log('New waha_endpoint:', newEndpoint)

    // 3. Update database
    await prisma.setting.upsert({
        where: { key: 'waha_endpoint' },
        update: { value: newEndpoint },
        create: { key: 'waha_endpoint', value: newEndpoint }
    })

    console.log('\n✅ Successfully updated waha_endpoint to port 3001')
    console.log('   The WhatsApp log fetching should now work correctly.')
}

main()
    .catch((e) => {
        console.error('❌ Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
