
import { prisma } from '../lib/prisma'

async function main() {
    const key = 'whatsapp_api_key'
    const value = 'e3f9a1c4d8b2f0a7c5e6d9b1a4f8c2d0e7b5a9c3f1d4b8e6a2f0c7'

    console.log(`Updating ${key}...`)

    const result = await prisma.setting.upsert({
        where: { key: key },
        update: { value: value },
        create: {
            key: key,
            value: value
        }
    })

    console.log(`✅ Updated: ${result.key} = "${result.value}"`)
}

main().catch(console.error)
