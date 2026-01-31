import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';

const prisma = new PrismaClient();

async function analyzeFullPrompt() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           ANALYSE DU PROMPT COMPLET                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const agent = await prisma.agent.findFirst({
        where: { name: 'Lena' },
        include: {
            profile: true,
            agentPrompts: {
                include: { prompt: true }
            }
        }
    });

    if (!agent) {
        console.log('❌ Agent not found');
        return;
    }

    const settings = await settingsService.getSettings();
    const corePrompt = agent.agentPrompts.find(p => p.type === 'CORE')?.prompt?.system_prompt || '';
    const phase = 'CRISIS';
    const details = { trustScore: 85, daysActive: 15 };

    const systemPrompt = await director.buildSystemPrompt(
        settings,
        { name: 'Marc', id: 'test-contact' },
        phase,
        details,
        corePrompt,
        agent.id,
        'Deep emotional connection'
    );

    console.log('📜 PROMPT COMPLET GÉNÉRÉ:\n');
    console.log('═'.repeat(70));
    console.log(systemPrompt);
    console.log('═'.repeat(70));

    // Analyze for duplicates
    console.log('\n\n🔍 ANALYSE DES DOUBLONS:\n');

    const keywords = [
        'BREVITY', 'BRIÈVETÉ', 'BRIEF',
        'bold', 'BOLD',
        'image', 'IMAGE',
        'paypal', 'PAYPAL', 'PayPal',
        'PAYMENT_RECEIVED',
        '8 words', '8 mots',
        'bracket', 'crochet',
        'separator', '|'
    ];

    keywords.forEach(keyword => {
        const regex = new RegExp(keyword, 'gi');
        const matches = systemPrompt.match(regex);
        if (matches && matches.length > 1) {
            console.log(`⚠️  "${keyword}" apparaît ${matches.length} fois`);
        }
    });

    // Count sections
    const sections = {
        'IDENTITY': (systemPrompt.match(/IDENTITY/gi) || []).length,
        'CONTEXT': (systemPrompt.match(/CONTEXT/gi) || []).length,
        'MISSION': (systemPrompt.match(/MISSION/gi) || []).length,
        'STYLE': (systemPrompt.match(/STYLE/gi) || []).length,
        'RULES': (systemPrompt.match(/RULES/gi) || []).length,
        'PAYMENT': (systemPrompt.match(/PAYMENT/gi) || []).length
    };

    console.log('\n📊 SECTIONS DÉTECTÉES:');
    Object.entries(sections).forEach(([section, count]) => {
        if (count > 1) {
            console.log(`   ⚠️  ${section}: ${count} fois (potentiel doublon)`);
        } else if (count === 1) {
            console.log(`   ✅ ${section}: ${count} fois`);
        }
    });

    // Check for contradictions
    console.log('\n⚠️  CONTRADICTIONS POTENTIELLES:');

    if (systemPrompt.includes('maximum 8 words') && systemPrompt.includes('1-5 words')) {
        console.log('   - Limite de mots contradictoire (8 vs 1-5)');
    }

    if ((systemPrompt.match(/bold/gi) || []).length > 2) {
        console.log('   - Règle "NO bold" répétée trop souvent');
    }

    console.log('\n✅ TAILLE DU PROMPT:');
    console.log(`   ${systemPrompt.length} caractères`);
    console.log(`   ${systemPrompt.split('\n').length} lignes`);

    await prisma.$disconnect();
}

analyzeFullPrompt().catch(console.error);
