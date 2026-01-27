import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const profile = await prisma.agentProfile.findFirst({
        where: { agent: { name: 'Anaïs' } }
    });

    if (!profile) {
        console.log('Anaïs profile not found!');
        return;
    }

    console.log('=== CONTEXT TEMPLATE ===');
    console.log(profile.contextTemplate || 'NULL');

    console.log('\n=== MISSION TEMPLATE ===');
    console.log(profile.missionTemplate || 'NULL');

    console.log('\n=== IDENTITY TEMPLATE ===');
    console.log(profile.identityTemplate || 'NULL');

    console.log('\n=== PHASE CONNECTION ===');
    console.log(profile.phaseConnectionTemplate || 'NULL');

    console.log('\n=== PHASE VULNERABILITY ===');
    console.log(profile.phaseVulnerabilityTemplate || 'NULL');

    console.log('\n=== PHASE CRISIS ===');
    console.log(profile.phaseCrisisTemplate || 'NULL');

    console.log('\n=== PHASE MONEYPOT ===');
    console.log(profile.phaseMoneypotTemplate || 'NULL');

    console.log('\n=== PAYMENT RULES ===');
    console.log(profile.paymentRules || 'NULL');

    console.log('\n=== SAFETY RULES ===');
    console.log(profile.safetyRules || 'NULL');

    console.log('\n=== STYLE RULES ===');
    console.log(profile.styleRules || 'NULL');

    await prisma.$disconnect();
}

main();
