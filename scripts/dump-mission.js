const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const profiles = await p.agentProfile.findMany({
        include: { agent: true }
    });

    for (const pr of profiles) {
        console.log('='.repeat(60));
        console.log('Agent:', pr.agent?.name, '(' + pr.agentId + ')');
        console.log('='.repeat(60));
        console.log('\n--- missionTemplate ---\n');
        console.log(pr.missionTemplate);
        console.log('\n');
    }
}

main().finally(() => p.$disconnect());
