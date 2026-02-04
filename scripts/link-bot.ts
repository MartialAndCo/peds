
import { prisma } from '../lib/prisma';

async function main() {
    const botUsername = 'lenamrt3';
    const agentName = 'Lena';

    const agent = await prisma.agent.findFirst({ where: { name: agentName } });
    if (!agent) throw new Error(`Agent ${agentName} not found`);

    const bot = await prisma.discordBot.update({
        where: { id: '1256545925560799294' }, // ID from previous step
        data: { agentId: agent.id }
    });

    console.log(`Linked bot ${bot.username} to agent ${agent.name}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
