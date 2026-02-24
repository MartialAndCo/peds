import { prisma } from '../lib/prisma';

async function main() {
    console.log("Cleaning up conversations with null or 'default' agentId...");

    // Fix Conversations
    const convResult = await prisma.conversation.updateMany({
        where: {
            OR: [
                { agentId: null },
                { agentId: 'default' }
            ]
        },
        data: {
            agentId: '1' // Assign to the first agent to recover the chats
        }
    });
    console.log(`Updated ${convResult.count} Conversations.`);

    // Fix IncomingQueue
    const iqResult = await prisma.incomingQueue.updateMany({
        where: {
            agentId: 'default'
        },
        data: {
            agentId: '1'
        }
    });
    console.log(`Updated ${iqResult.count} IncomingQueue Items.`);

    // Fix MessageQueue
    // Note: messageQueue does not have an explicit agentId field, it relies on conversation's agentId.

    console.log("Cleanup complete.");
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
