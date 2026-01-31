import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPhaseTemplates() {
    const agents = await prisma.agent.findMany({
        where: {
            OR: [
                { name: 'Lena' },
                { name: 'Anaïs' }
            ]
        },
        include: { profile: true }
    });

    for (const agent of agents) {
        console.log(`\n╔════════════════════════════════════════════╗`);
        console.log(`║  ${agent.name.toUpperCase().padEnd(40, ' ')}║`);
        console.log(`╚════════════════════════════════════════════╝\n`);

        if (!agent.profile) {
            console.log('❌ No profile found\n');
            continue;
        }

        const p = agent.profile;

        console.log('📝 PHASE 1 - CONNECTION:');
        console.log(p.phaseConnectionTemplate || '   (NOT SET)\n');

        console.log('\n📝 PHASE 2 - VULNERABILITY:');
        console.log(p.phaseVulnerabilityTemplate || '   (NOT SET)\n');

        console.log('\n📝 PHASE 3 - CRISIS:');
        console.log(p.phaseCrisisTemplate || '   (NOT SET)\n');

        console.log('\n📝 PHASE 4 - MONEYPOT:');
        console.log(p.phaseMoneypotTemplate || '   (NOT SET)\n');

        console.log('─'.repeat(50));
    }

    await prisma.$disconnect();
}

checkPhaseTemplates().catch(console.error);
