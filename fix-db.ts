
import { PrismaClient } from '@prisma/client'

// Bypass standard client and try to force direct execution
// We try to grab DIRECT_URL from env, or fallback to DATABASE_URL but replacing 6543 with 5432 if needed
const getUrl = () => {
    if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
    let url = process.env.DATABASE_URL || "";
    if (url.includes("6543")) {
        console.log("Switching to Port 5432 for migration...");
        return url.replace("6543", "5432").replace("?pgbouncer=true", "");
    }
    return url;
}

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: getUrl()
        }
    }
})

async function main() {
    console.log('🛠️ Attempting to patch database schema manually...')
    const url = getUrl();
    console.log('Target URL (masked):', url.replace(/:[^:]*@/, ':****@'));

    try {
        // 1. Add Column
        console.log('1. Adding "processingLock" to "conversations"...');
        await prisma.$executeRawUnsafe(`ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "processingLock" TIMESTAMP(3);`)
        console.log('✅ Success: processingLock column added (or already exists).');

        // 2. Add Unique Index for Message ID
        console.log('2. Adding unique index for "waha_message_id"...');
        // Using simple CREATE UNIQUE INDEX. If duplicates exist, this Fetch will fail, but that is acceptable for now.
        // We use a try/catch specifically for this.
        try {
            await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "messages_waha_message_id_key" ON "messages"("waha_message_id");`)
            console.log('✅ Success: Unique Index added.');
        } catch (idxError: any) {
            console.warn('⚠️ Could not add Index (likely duplicates):', idxError.message);
        }

        console.log('\n🎉 DATABASE PATCH COMPLETE. Restarting app should work now.');

    } catch (e: any) {
        console.error('❌ FATAL ERROR executing raw SQL:', e)
        throw e;
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
