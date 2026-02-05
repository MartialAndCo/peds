
import { prisma } from '../lib/prisma';

async function main() {
    const agent = await prisma.agent.findFirst({
        where: { name: 'Lena' },
        include: { profile: true }
    });

    if (!agent) {
        console.log('Agent Lena not found');
        return;
    }

    console.log(`Agent: ${agent.name}`);
    console.log(`Timezone: ${agent.profile?.timezone}`);
    console.log(`Now (Server): ${new Date().toISOString()}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
