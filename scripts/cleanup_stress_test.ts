
import { prisma } from '@/lib/prisma'
import { memoryService } from '@/lib/memory'

async function cleanup() {
    console.log('[FULL_CLEANUP] Starting...');

    // All test phone patterns
    const patterns = ['+998000', '+999000', '+9999999'];

    for (const pattern of patterns) {
        console.log(`[FULL_CLEANUP] Looking for contacts matching ${pattern}...`);

        const contacts = await prisma.contact.findMany({
            where: { phone_whatsapp: { startsWith: pattern } },
            select: { id: true, phone_whatsapp: true }
        });

        if (contacts.length === 0) {
            console.log(`[FULL_CLEANUP] No contacts found for ${pattern}.`);
            continue;
        }

        console.log(`[FULL_CLEANUP] Found ${contacts.length} contacts for ${pattern}. Deleting...`);
        const ids = contacts.map((c: any) => c.id);
        const phones = contacts.map((c: any) => c.phone_whatsapp);

        // Delete related data
        await prisma.message.deleteMany({ where: { conversation: { contactId: { in: ids } } } });
        await prisma.messageQueue.deleteMany({ where: { contactId: { in: ids } } });
        await prisma.conversation.deleteMany({ where: { contactId: { in: ids } } });
        await prisma.payment.deleteMany({ where: { contactId: { in: ids } } });
        await prisma.contact.deleteMany({ where: { id: { in: ids } } });

        console.log(`[FULL_CLEANUP] Deleted ${contacts.length} contacts for ${pattern}.`);

        // Delete Memories (Mem0)
        console.log(`[FULL_CLEANUP] Deleting memories for ${phones.length} phone numbers...`);
        for (const phone of phones) {
            try {
                await memoryService.deleteAll(phone);
                console.log(`[FULL_CLEANUP] Deleted memories for ${phone}`);
            } catch (e: any) {
                // Mem0 might not have entries for these, that's OK
                // console.warn(`[FULL_CLEANUP] Memory delete failed for ${phone}:`, e.message);
            }
        }
    }

    // Also delete IncomingQueue junk from stress tests
    console.log('[FULL_CLEANUP] Cleaning IncomingQueue...');
    const queueDeleted = await prisma.incomingQueue.deleteMany({
        where: {
            OR: [
                { status: 'DONE' },
                { status: 'FAILED' },
                { status: 'PROCESSING' } // stale
            ]
        }
    });
    console.log(`[FULL_CLEANUP] Deleted ${queueDeleted.count} queue items.`);

    console.log('[FULL_CLEANUP] Done.');
}

cleanup()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
