const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Media Types...');

    const types = [
        { id: 'photo_pieds', keywords: ['pieds', 'pied', 'feet', 'toes', 'orteils'], description: 'Photos de pieds' },
        { id: 'photo_mains', keywords: ['mains', 'main', 'hand', 'hands', 'fingers'], description: 'Photos de mains' },
        { id: 'photo_visage', keywords: ['visage', 'face', 'selfie', 'tête', 'sourire'], description: 'Selfies ou photos de visage' },
        { id: 'video_danse', keywords: ['danse', 'dance', 'danser'], description: 'Vidéos de danse' },
        { id: 'photo_tenue_rouge', keywords: ['rouge', 'red', 'robe rouge', 'tenue rouge'], description: 'Photos en tenue rouge' }
    ];

    for (const t of types) {
        await prisma.mediaType.upsert({
            where: { id: t.id },
            update: { keywords: t.keywords, description: t.description },
            create: { id: t.id, keywords: t.keywords, description: t.description }
        });
        console.log(`Upserted ${t.id}`);
    }

    console.log('Done.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
