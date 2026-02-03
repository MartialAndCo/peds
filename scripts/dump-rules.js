const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔧 Dumping current styleRules and phaseCrisisTemplate...\n');

    const profiles = await prisma.agentProfile.findMany({
        include: { agent: true }
    });

    for (const pr of profiles) {
        console.log('='.repeat(60));
        console.log('Agent:', pr.agent?.name);
        console.log('='.repeat(60));

        console.log('\n--- styleRules ---\n');
        console.log(pr.styleRules || '(empty)');

        console.log('\n--- phaseCrisisTemplate ---\n');
        console.log(pr.phaseCrisisTemplate || '(empty)');

        console.log('\n');
    }
}

main().finally(() => prisma.$disconnect());
