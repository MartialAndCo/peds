
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const agentIdParam = "1"; // Assuming Agent 1
    const agentId = parseInt(agentIdParam);

    console.log(`Testing query for AgentId: ${agentId}`);

    const where = {
        OR: [
            { agentId: agentId },
            { agentId: null }
        ]
    };

    console.log("Query 'where' object:", JSON.stringify(where, null, 2));

    const conversations = await prisma.conversation.findMany({
        where,
        include: {
            contact: true,
            prompt: true,
            messages: {
                orderBy: { timestamp: 'desc' },
                take: 1
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${conversations.length} conversations.`);
    if (conversations.length > 0) {
        console.log("First conversation AgentId:", conversations[0].agentId);
        console.log("First conversation Contact:", conversations[0].contact.name);
    } else {
        console.log("No conversations found match this criteria.");

        // Debug: Check if any conversations exist at all for this agent without the OR
        const strict = await prisma.conversation.count({ where: { agentId } });
        console.log(`Strict count for agentId ${agentId}: ${strict}`);

        const nullCount = await prisma.conversation.count({ where: { agentId: null } });
        console.log(`Count for agentId NULL: ${nullCount}`);
    }

    await prisma.$disconnect();
}

main().catch(console.error);
