const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Force Creating Tables...');

    try {
        // Media Types
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "media_types" (
                "id" TEXT NOT NULL,
                "description" TEXT,
                "keywords" TEXT[],
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "media_types_pkey" PRIMARY KEY ("id")
            );
        `);
        console.log('Created media_types');

        // Medias
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "medias" (
                "id" SERIAL NOT NULL,
                "typeId" TEXT NOT NULL,
                "url" TEXT NOT NULL,
                "sentTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "medias_pkey" PRIMARY KEY ("id")
            );
        `);
        console.log('Created medias');

        // Pending Requests
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "pending_requests" (
                "id" SERIAL NOT NULL,
                "typeId" TEXT NOT NULL,
                "requesterPhone" TEXT NOT NULL,
                "status" TEXT NOT NULL DEFAULT 'pending',
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "pending_requests_pkey" PRIMARY KEY ("id")
            );
        `);
        console.log('Created pending_requests');

        // Blacklist Rules
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "blacklist_rules" (
                "id" SERIAL NOT NULL,
                "term" TEXT NOT NULL,
                "mediaType" TEXT NOT NULL DEFAULT 'all',
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "blacklist_rules_pkey" PRIMARY KEY ("id")
            );
        `);
        console.log('Created blacklist_rules');

        // Settings (source_phone_number) - Setting table exists, but we might need to ensure upsert works.
        // Prisma handles that.

        console.log('Tables created successfully.');

    } catch (e) {
        console.error('Error creating tables:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
