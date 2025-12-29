
import { prisma } from '@/lib/prisma';

async function clear() {
    // Delete all media items
    const deleted = await prisma.media.deleteMany({});
    console.log(`Deleted ${deleted.count} media items.`);

    // Also clear pending requests to reset flow? Maybe not needed, but safer.
    // await prisma.pendingRequest.deleteMany({});
}

clear();
