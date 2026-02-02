
import { prisma } from '../lib/prisma';
import fs from 'fs';

async function main() {
    const agent = await prisma.agent.findFirst({
        where: { name: { contains: 'Lena', mode: 'insensitive' } },
        include: { profile: true }
    });

    if (!agent || !agent.profile) {
        console.error("Agent or Profile not found");
        return;
    }

    const dump = {
        agent: { name: agent.name, id: agent.id },
        profile: agent.profile
    };

    fs.writeFileSync('lena-profile-dump.json', JSON.stringify(dump, null, 2));
    console.log("Dump written to lena-profile-dump.json");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
