const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPrompts() {
    try {
        const prompts = await prisma.prompt.findMany({
            where: { isActive: true }
        });
        console.log('Active Prompts:', JSON.stringify(prompts, null, 2));

        const conversation = await prisma.conversation.findFirst({
            orderBy: { updatedAt: 'desc' },
            include: { prompt: true }
        });
        console.log('Most recent conversation prompt:', conversation?.prompt);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
checkPrompts();
