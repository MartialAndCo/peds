
import { prisma } from '../lib/prisma';

async function main() {
    console.log('--- Discord Bots ---');
    const bots = await prisma.discordBot.findMany();
    console.log(JSON.stringify(bots, null, 2));

    console.log('\n--- Agents ---');
    const agents = await prisma.agent.findMany({
        select: { id: true, name: true, phone: true }
    });
    console.log(JSON.stringify(agents, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
