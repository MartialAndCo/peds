const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Media Types (Raw SQL)...');

    const types = [
        { id: 'photo_pieds', keywords: ['pieds', 'pied', 'feet', 'toes', 'orteils'], description: 'Photos de pieds' },
        { id: 'photo_mains', keywords: ['mains', 'main', 'hand', 'hands', 'fingers'], description: 'Photos de mains' },
        { id: 'photo_visage', keywords: ['visage', 'face', 'selfie', 'tête', 'sourire'], description: 'Selfies ou photos de visage' },
        { id: 'video_danse', keywords: ['danse', 'dance', 'danser'], description: 'Vidéos de danse' },
        { id: 'photo_tenue_rouge', keywords: ['rouge', 'red', 'robe rouge', 'tenue rouge'], description: 'Photos en tenue rouge' }
    ];

    for (const t of types) {
        // Postgres ON CONFLICT Upsert
        await prisma.$executeRawUnsafe(`
            INSERT INTO "media_types" ("id", "keywords", "description", "createdAt")
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT ("id") DO UPDATE 
            SET "keywords" = $2, "description" = $3;
        `, t.id, t.keywords, t.description);
        console.log(`Upserted ${t.id}`);
    }

    console.log('Done.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
