const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Testing DB Connection...');
    try {
        const count = await prisma.user.count(); // Assuming User table exists and is stable
        console.log(`Connection Successful! Found ${count} users.`);

        // Check for new tables
        try {
            const types = await prisma.mediaType.count();
            console.log(`MediaType table exists. Count: ${types}`);
        } catch (e) {
            console.log('MediaType table DOES NOT exist yet.');
        }

    } catch (e) {
        console.error('Connection Failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
