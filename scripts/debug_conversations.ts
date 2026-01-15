
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Debugging Conversations ---");

    // 1. Count all conversations
    const total = await prisma.conversation.count();
    console.log(`Total Conversations: ${total}`);

    // 2. Group by AgentId
    const grouped = await prisma.conversation.groupBy({
        by: ['agentId'],
        _count: { id: true }
    });
    console.log("Conversations by AgentId:", grouped);

    // 3. List last 5 conversations with details
    const recent = await prisma.conversation.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { agent: true }
    });

    console.log("\nLast 5 Conversations:");
    recent.forEach(c => {
        console.log(`- ID: ${c.id} | Contact: ${c.contactId} | Agent: ${c.agentId} (${c.agent?.name}) | Status: ${c.status}`);
    });

    await prisma.$disconnect();
}

main().catch(console.error);
