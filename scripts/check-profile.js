const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const r = await p.agentProfile.findFirst({
        where: { agentId: 'cmkvg0kzz00003vyv03zzt9kc' }
    });

    console.log('=== paymentRules ===');
    console.log(r.paymentRules);
    console.log('\n=== missionTemplate ===');
    console.log(r.missionTemplate);
}

main().finally(() => p.$disconnect());
