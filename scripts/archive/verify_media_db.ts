
import { prisma } from '@/lib/prisma';

async function verify() {
    const medias = await prisma.media.findMany({ take: 3, orderBy: { id: 'desc' } });
    medias.forEach(m => {
        console.log(`ID: ${m.id}, Type: ${m.typeId}`);
        console.log(`URL Start: ${m.url.substring(0, 50)}...`);
    });
}
verify();
