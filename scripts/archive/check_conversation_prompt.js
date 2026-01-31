const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConversation() {
    try {
        const conversations = await prisma.conversation.findMany({
            include: { prompt: true, contact: true }
        });

        console.log('Conversations:', JSON.stringify(conversations, null, 2));

        const activePrompt = await prisma.prompt.findFirst({
            where: { isActive: true }
        });
        console.log('Active Prompt ID:', activePrompt?.id);

    } catch (e) {
        console.log(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkConversation();
