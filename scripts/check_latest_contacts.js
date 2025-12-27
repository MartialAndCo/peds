const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Checking latest contacts...')
    console.log('Checking simulation contacts...')
    const contacts = await prisma.contact.findMany({
        where: { phone_whatsapp: { contains: '99999999' } }, // Filter for simulation
        include: { conversations: { include: { messages: { orderBy: { timestamp: 'asc' } } } } },
        orderBy: { createdAt: 'desc' },
        take: 1
    });

    console.log(`Found ${contacts.length} simulation contacts:`);
    contacts.forEach(c => {
        console.log(`- [${c.id}] ${c.name} (${c.phone_whatsapp})`);
        console.log(`  Status: ${c.status}`);
        console.log(`  Phase: ${c.agentPhase}`);
        const msgs = c.conversations[0]?.messages || [];
        console.log(`  Messages (${msgs.length}):`);
        msgs.forEach(m => console.log(`    [${m.sender}]: ${m.message_text}`));
        console.log("---\n");
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())

