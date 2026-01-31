const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
    const wahaEndpoint = "http://13.60.16.81:3000"
    const wahaApiKey = process.argv[2] || "secret" // Allow passing API key as arg

    console.log(`Updating WAHA settings to: ${wahaEndpoint}`)

    try {
        await prisma.setting.upsert({
            where: { key: 'waha_endpoint' },
            update: { value: wahaEndpoint },
            create: { key: 'waha_endpoint', value: wahaEndpoint }
        })

        await prisma.setting.upsert({
            where: { key: 'waha_api_key' },
            update: { value: wahaApiKey },
            create: { key: 'waha_api_key', value: wahaApiKey }
        })

        console.log('WAHA settings updated successfully!')
    } catch (e) {
        console.error('Error updating settings:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
