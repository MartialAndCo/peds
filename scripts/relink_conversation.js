const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function relink() {
    try {
        // Get active prompt
        const activePrompt = await prisma.prompt.findFirst({
            where: { isActive: true }
        });

        if (!activePrompt) {
            console.error('No active prompt found!');
            return;
        }

        console.log('Active Prompt:', activePrompt.id, activePrompt.system_prompt.substring(0, 50) + '...');

        // Fetch all conversations first
        const conversations = await prisma.conversation.findMany();
        console.log(`Found ${conversations.length} conversations to update.`);

        let updatedCount = 0;
        for (const convo of conversations) {
            await prisma.conversation.update({
                where: { id: convo.id },
                data: {
                    promptId: activePrompt.id,
                    updatedAt: new Date()
                }
            });
            updatedCount++;
        }

        console.log(`Successfully relinked ${updatedCount} conversations to prompt ID ${activePrompt.id}.`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

relink();
