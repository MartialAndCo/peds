import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyPhase2Fixes() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║      VERIFICATION DES CORRECTIONS PHASE 2                  ║');
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

        // Check Phase 2 template
        const phase2 = agent.profile.phaseVulnerabilityTemplate || '';
        console.log('\n✅ PHASE 2 TEMPLATE CHECKS:');

        const checks = [
            {
                test: phase2.includes('🚫') || phase2.includes('INTERDICTION') || phase2.includes('BAN'),
                label: 'Contains IRL ban symbols'
            },
            {
                test: isFrench
                    ? (phase2.includes('JAMAIS') && phase2.includes('rencontrer'))
                    : (phase2.includes('NEVER') && phase2.includes('meeting')),
                label: 'Explicit "NEVER meet IRL" rule'
            },
            {
                test: isFrench
                    ? phase2.includes('mère') && phase2.includes('strict')
                    : phase2.includes('mom') && phase2.includes('strict'),
                label: 'Mentions strict mom'
            },
            {
                test: isFrench
                    ? phase2.includes('BRÈVE') || phase2.includes('BRIEF')
                    : phase2.includes('BRIEF'),
                label: 'Requires brevity'
            },
            {
                test: isFrench
                    ? phase2.includes('vulnérabilité') || phase2.includes('problèmes')
                    : phase2.includes('vulnerability') || phase2.includes('problems'),
                label: 'Emphasizes vulnerability sharing'
            }
        ];

        checks.forEach(check => {
            console.log(`   ${check.test ? '✓' : '❌'} ${check.label}`);
        });

        // Check Style Rules
        const style = agent.profile.styleRules || '';
        console.log('\n✅ STYLE RULES CHECKS:');

        const styleChecks = [
            {
                test: style.includes('1-5') || style.includes('1-8'),
                label: 'Max word count specified'
            },
            {
                test: isFrench
                    ? style.includes('Minuscules')
                    : style.includes('Lowercase'),
                label: 'Lowercase requirement'
            },
            {
                test: style.includes('4-5'),
                label: 'Questions only after 4-5 messages'
            },
            {
                test: isFrench
                    ? style.includes('INTERDITES')
                    : style.includes('BANNED'),
                label: 'Lists banned phrases'
            }
        ];

        styleChecks.forEach(check => {
            console.log(`   ${check.test ? '✓' : '❌'} ${check.label}`);
        });

        // Sample scenarios
        console.log('\n📋 EXPECTED BEHAVIORS:');
        if (isFrench) {
            console.log('   User: "On se voit ce weekend?"');
            console.log('   ✓ CORRECT: "jvoudrais bien mais ma mère me laisse pas sortir 😞"');
            console.log('   ❌ WRONG: "Ouais! On pourrait aller voir un match!"');
            console.log('');
            console.log('   User: "Envoie-moi un vocal"');
            console.log('   ✓ CORRECT: "j\'préfère écrire là"');
            console.log('   ❌ WRONG: "[VOICE] Hey! Ça va?"');
        } else {
            console.log('   User: "wanna hang out this weekend?"');
            console.log('   ✓ CORRECT: "wish i could but my mom wont let me go out 😞"');
            console.log('   ❌ WRONG: "Yeah! We should catch a game!"');
            console.log('');
            console.log('   User: "send me a voice note"');
            console.log('   ✓ CORRECT: "prefer texting rn"');
            console.log('   ❌ WRONG: "[VOICE] Hey! What\'s up?"');
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ VERIFICATION COMPLETE');
    console.log('\n📌 KEY FIXES APPLIED:');
    console.log('   1. 🚫 ABSOLUTE BAN on suggesting IRL meetups');
    console.log('   2. 🏠 Mom is strict - cannot go out');
    console.log('   3. 📝 Ultra brief messages (1-5 words typically)');
    console.log('   4. 🎤 Voice notes ONLY for verification');
    console.log('   5. 💬 Share 3-6 vulnerabilities in Phase 2');
    console.log('   6. ❓ Questions only after 4-5 messages\n');

    await prisma.$disconnect();
}

verifyPhase2Fixes().catch(console.error);
