
import { prisma } from '../lib/prisma';

async function main() {
    console.log("Searching for Anaïs...");
    const agent = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } },
        include: { profile: true }
    });

    if (!agent) {
        console.error("Agent Anaïs not found!");
        return;
    }

    console.log(`Found Agent: ${agent.name} (${agent.id})`);

    if (!agent.profile) {
        console.error("No Profile found for this agent!");
        return;
    }

    console.log("\n--- AGENT PROFILE DUMP ---");
    console.log(JSON.stringify(agent.profile, null, 2));
    console.log("\n--- END DUMP ---");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
