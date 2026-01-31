import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🚀 Forcing manual schema updates via SQL...')

    try {
        // 1. Add 'profile' to Contact
        console.log('Adding "profile" to contacts...')
        await prisma.$executeRawUnsafe(`ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "profile" JSONB;`)

        // 2. Add 'mediaUrl' to Message
        console.log('Adding "mediaUrl" to messages...')
        await prisma.$executeRawUnsafe(`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;`)

        // 3. Add 'isHidden' to Contact
        console.log('Adding "isHidden" to contacts...')
        await prisma.$executeRawUnsafe(`ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN DEFAULT false;`)

        // 4. Add 'testMode' to Contact
        console.log('Adding "testMode" to contacts...')
        await prisma.$executeRawUnsafe(`ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "testMode" BOOLEAN DEFAULT false;`)

        console.log('✅ Success! Columns added.')
    } catch (e) {
        console.error('❌ Error executing SQL:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
