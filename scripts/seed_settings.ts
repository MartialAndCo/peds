
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding Settings...')

    const sourcePhone = process.env.SOURCE_PHONE_NUMBER || '0000000000';

    // 1. Ensure source_phone_number (legacy/Admin) exists
    await prisma.setting.upsert({
        where: { key: 'source_phone_number' },
        update: {},
        create: { key: 'source_phone_number', value: sourcePhone }
    })

    // 2. Ensure media_source_number (New) exists
    // Default to same as sourcePhone initially to avoid breaking flow
    await prisma.setting.upsert({
        where: { key: 'media_source_number' },
        update: {},
        create: { key: 'media_source_number', value: sourcePhone }
    })

    console.log('Settings seeded.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
