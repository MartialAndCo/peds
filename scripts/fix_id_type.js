const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('🔧 FIXING ID TYPES (Int -> Text)...')

    try {
        // 1. Drop Foreign Key Constraint on conversations
        console.log('1. Dropping FK constraint...')
        await prisma.$executeRawUnsafe(`ALTER TABLE conversations DROP CONSTRAINT IF EXISTS "conversations_contactId_fkey";`)

        // 2. Alert Contact ID
        console.log('2. Altering contacts.id to TEXT...')
        // We need to drop the default if it was autoincrement sequence
        await prisma.$executeRawUnsafe(`ALTER TABLE contacts ALTER COLUMN id DROP DEFAULT;`)
        await prisma.$executeRawUnsafe(`ALTER TABLE contacts ALTER COLUMN id TYPE TEXT USING id::text;`)

        // 3. Alter Conversation contactId
        console.log('3. Altering conversations.contactId to TEXT...')
        await prisma.$executeRawUnsafe(`ALTER TABLE conversations ALTER COLUMN "contactId" TYPE TEXT USING "contactId"::text;`)

        // 4. Re-add Foreign Key (Optional but good practice, Prisma usually manages it via _prisma_migrations but we are in manual mode)
        // Note: We need to ensure types match. Both are now TEXT.
        console.log('4. Re-creating FK constraint...')
        await prisma.$executeRawUnsafe(`
            ALTER TABLE conversations 
            ADD CONSTRAINT "conversations_contactId_fkey" 
            FOREIGN KEY ("contactId") REFERENCES contacts(id) ON DELETE CASCADE ON UPDATE CASCADE;
        `)

        console.log('✅ ID Types Fixed.')

    } catch (e) {
        console.error('⚠️ Migration Error:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
