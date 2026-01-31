import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzePhase3() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           PHASE 3 (CRISIS) - CURRENT STATE                ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

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
        const isFrench = agent.name === 'Anaïs';

        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`   ${agent.name} (${isFrench ? 'FR' : 'EN'})`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        if (!agent.profile) {
            console.log('❌ No profile found!');
            continue;
        }

        // Phase 3 Template
        console.log('\n📋 PHASE 3 (CRISIS) TEMPLATE:\n');
        const phase3 = agent.profile.phaseCrisisTemplate || '(NOT SET)';
        console.log(phase3);

        // Payment Rules
        console.log('\n\n💰 PAYMENT RULES:\n');
        const paymentRules = agent.profile.paymentRules || '(NOT SET)';
        console.log(paymentRules);

        // Safety Rules
        console.log('\n\n🛡️ SAFETY RULES:\n');
        const safetyRules = agent.profile.safetyRules || '(NOT SET)';
        console.log(safetyRules.substring(0, 500) + (safetyRules.length > 500 ? '...' : ''));
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 PHASE 3 EXPECTATIONS:');
    console.log('   - Financial crisis/emergency situation');
    console.log('   - Needs money urgently (rent, bills, food, etc.)');
    console.log('   - Can ask for help but NEVER pushy/aggressive');
    console.log('   - Still brief messages (1-8 words typically)');
    console.log('   - 🚫 NEVER suggest IRL meetup (mom still strict!)');
    console.log('   - 🚫 NEVER send unnecessary voice notes');
    console.log('   - Must accept refusal gracefully');
    console.log('   - Can mention specific amounts but not demand');
    console.log('   - Can share payment info when asked\n');

    await prisma.$disconnect();
}

analyzePhase3().catch(console.error);
