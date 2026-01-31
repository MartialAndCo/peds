const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('🔥 TRUNCATING TABLES due to ID type mismatch (Int vs String)...')
    try {
        // We use CASCADE to also delete conversations/messages linked to these contacts
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE contacts CASCADE;`)
        console.log('✅ Contacts truncated.')
    } catch (e) {
        console.log('⚠️ Truncate error:', e.message)
    }

    console.log('Forcing manual migration...')

    try {
        console.log('Adding agentPhase...')
        await prisma.$executeRawUnsafe(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "agentPhase" TEXT DEFAULT 'CONNECTION';`)
        console.log('✅ agentPhase added.')
    } catch (e) {
        console.log('⚠️ agentPhase error/exists:', e.message)
    }

    try {
        console.log('Adding trustScore...')
        await prisma.$executeRawUnsafe(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "trustScore" INTEGER DEFAULT 0;`)
        console.log('✅ trustScore added.')
    } catch (e) {
        console.log('⚠️ trustScore error/exists:', e.message)
    }

    try {
        console.log('Adding lastPhaseUpdate...')
        await prisma.$executeRawUnsafe(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "lastPhaseUpdate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;`)
        console.log('✅ lastPhaseUpdate added.')
    } catch (e) {
        console.log('⚠️ lastPhaseUpdate error/exists:', e.message)
    }

    try {
        console.log('Adding updatedAt...')
        await prisma.$executeRawUnsafe(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;`)
        console.log('✅ updatedAt added.')
    } catch (e) {
        console.log('⚠️ updatedAt error/exists:', e.message)
    }

    try {
        console.log('Adding createdAt...')
        await prisma.$executeRawUnsafe(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;`)
        console.log('✅ createdAt added.')
    } catch (e) {
        console.log('⚠️ createdAt error/exists:', e.message)
    }

    console.log('Migration complete.')
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
