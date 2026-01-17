
import { prisma } from '../lib/prisma'

async function main() {
    const setting = await prisma.setting.findUnique({
        where: { key: 'whatsapp_api_key' }
    })
    console.log(`[DB] whatsapp_api_key: "${setting?.value || 'NOT FOUND'}"`)
}

main().catch(console.error)
