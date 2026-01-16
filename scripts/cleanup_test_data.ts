import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
    console.log('🧹 Cleaning up test data...');

    // 1. Delete PendingRequests from test phones
    const del1 = await prisma.pendingRequest.deleteMany({
        where: { requesterPhone: { contains: '33799999999' } }
    });
    console.log(`   PendingRequest (33799999999): ${del1.count} deleted`);

    const del2 = await prisma.pendingRequest.deleteMany({
        where: { requesterPhone: { contains: '33700000001' } }
    });
    console.log(`   PendingRequest (33700000001): ${del2.count} deleted`);

    // 2. Delete test contacts and their data
    for (const phone of ['+33799999999', '+33700000001']) {
        const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: phone } });
        if (contact) {
            await prisma.messageQueue.deleteMany({ where: { contactId: contact.id } });
            await prisma.message.deleteMany({ where: { conversation: { contactId: contact.id } } });
            await prisma.conversation.deleteMany({ where: { contactId: contact.id } });
            await prisma.payment.deleteMany({ where: { contactId: contact.id } });
            await prisma.trustLog.deleteMany({ where: { contactId: contact.id } });
            await prisma.contact.delete({ where: { id: contact.id } });
            console.log(`   Contact ${phone}: deleted`);
        }
    }

    // 3. Clean IncomingQueue from test messages
    const del3 = await prisma.incomingQueue.deleteMany({
        where: {
            payload: {
                path: ['from'],
                string_contains: '33799999999'
            }
        }
    });
    console.log(`   IncomingQueue: ${del3.count} deleted`);

    await prisma.$disconnect();
    console.log('✅ Cleanup complete!');
}

cleanup();
