// Add log_forwarding_enabled to database
import { prisma } from './lib/prisma'

async function addLogForwardingSetting() {
    const result = await prisma.setting.upsert({
        where: { key: 'log_forwarding_enabled' },
        update: { value: 'true' },
        create: { key: 'log_forwarding_enabled', value: 'true' }
    })

    console.log('✅ log_forwarding_enabled set to:', result.value)

    // Verify all settings
    const all = await prisma.setting.findMany({
        where: {
            key: {
                in: ['log_forwarding_enabled', 'waha_endpoint', 'waha_api_key']
            }
        }
    })

    console.log('\n=== ALL LOG SETTINGS ===')
    all.forEach(s => console.log(`${s.key}: ${s.value}`))
}

addLogForwardingSetting().then(() => process.exit(0)).catch(e => {
    console.error('Error:', e)
    process.exit(1)
})
