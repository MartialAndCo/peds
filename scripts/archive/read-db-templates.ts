import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function readTemplates() {
    const agent = await prisma.agent.findFirst({
        where: { name: 'Lena' },
        include: { profile: true }
    });

    if (!agent?.profile) {
        console.log('No profile found');
        await prisma.$disconnect();
        return;
    }

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           TEMPLATES ACTUELS EN BASE DE DONNÉES                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('━━━ PHASE 2 (VULNERABILITY) ━━━\n');
    console.log(agent.profile.phaseVulnerabilityTemplate || '(NOT SET)');

    console.log('\n\n━━━ PHASE 3 (CRISIS) ━━━\n');
    console.log(agent.profile.phaseCrisisTemplate || '(NOT SET)');

    console.log('\n\n━━━ PHASE 4 (MONEYPOT) ━━━\n');
    console.log(agent.profile.phaseMoneypotTemplate || '(NOT SET)');

    console.log('\n\n━━━ STYLE RULES ━━━\n');
    console.log(agent.profile.styleRules || '(NOT SET)');

    console.log('\n\n━━━ PAYMENT RULES ━━━\n');
    console.log(agent.profile.paymentRules || '(NOT SET)');

    await prisma.$disconnect();
}

readTemplates().catch(console.error);
