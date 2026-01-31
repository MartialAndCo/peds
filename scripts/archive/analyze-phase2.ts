import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzePhase2() {
    const contact = await prisma.contact.findUnique({
        where: { phone_whatsapp: '+1555TEST002' }
    });

    if (!contact) {
        console.log('❌ Contact not found');
        await prisma.$disconnect();
        return;
    }

    const messages = await prisma.message.findMany({
        where: { conversation: { contactId: contact.id } },
        orderBy: { timestamp: 'asc' },
        select: {
            sender: true,
            message_text: true,
            timestamp: true
        }
    });

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║         PHASE 2 - VULNERABILITY CONVERSATION ANALYSIS        ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log(`📊 Total messages: ${messages.length}\n`);
    console.log('─────────────────────────────────────────────────────────────────\n');

    messages.forEach((m, i) => {
        const icon = m.sender === 'contact' ? '👨 Marc' : '👧 Lena';
        const msg = m.message_text.trim().replace(/\n/g, ' ↵ ');
        console.log(`${(i + 1).toString().padStart(2, '0')}. ${icon}: "${msg}"`);
    });

    console.log('\n─────────────────────────────────────────────────────────────────');
    console.log('\n🔍 PHASE 2 BEHAVIOR ANALYSIS:\n');

    const lenaMessages = messages.filter(m => m.sender === 'ai');

    let issues: string[] = [];
    let good: string[] = [];

    // Check for vulnerabilities shared
    const vulnerabilityKeywords = [
        'stressed', 'worried', 'scared', 'anxious', 'lonely', 'sad',
        'problem', 'struggle', 'hard', 'difficult', 'tough', 'sucks',
        'mom', 'dad', 'family', 'fight', 'argue', 'money', 'broke'
    ];

    let vulnerabilitiesCount = 0;
    lenaMessages.forEach((m, i) => {
        const text = m.message_text.toLowerCase();

        // Check vulnerabilities
        const foundVulnerabilities = vulnerabilityKeywords.filter(kw => text.includes(kw));
        if (foundVulnerabilities.length > 0) {
            vulnerabilitiesCount++;
            good.push(`✓ Shared vulnerability (msg ${i + 1}): ${foundVulnerabilities.join(', ')}`);
        }

        // Check if too long (Phase 2 should still be relatively brief)
        const wordCount = m.message_text.split(/\s+/).length;
        if (wordCount > 15) {
            issues.push(`⚠️  Too verbose (msg ${i + 1}): ${wordCount} words - "${m.message_text.substring(0, 50)}..."`);
        }

        // Check for repetition
        if (i > 0 && m.message_text === lenaMessages[i - 1]?.message_text) {
            issues.push(`⚠️  Exact repetition detected (msg ${i + 1})`);
        }

        // Check for IRL meetup suggestions (too fast for Phase 2)
        if (text.includes('meet') || text.includes('hang out') || (text.includes('game') && text.includes('watch together'))) {
            issues.push(`⚠️  Suggests IRL meetup too early (msg ${i + 1}): "${m.message_text.substring(0, 60)}..."`);
        }

        // Check for [VOICE] tag appearing when not appropriate
        if (m.message_text.includes('[VOICE]') && !text.includes('prove') && !text.includes('fake')) {
            issues.push(`⚠️  Unnecessary voice note (msg ${i + 1}) - should only be for verification`);
        }
    });

    console.log('✅ POSITIVE BEHAVIORS (PHASE 2):');
    if (good.length === 0) {
        console.log('   None detected');
    } else {
        good.forEach(g => console.log(`   ${g}`));
    }

    console.log(`\n📊 VULNERABILITIES SHARED: ${vulnerabilitiesCount}`);
    console.log('   Expected for Phase 2: 3-6');

    console.log('\n⚠️  ISSUES DETECTED:');
    if (issues.length === 0) {
        console.log('   None');
    } else {
        issues.forEach(i => console.log(`   ${i}`));
    }

    console.log('\n💡 PHASE 2 EXPECTATIONS:');
    console.log('   - Lena should share more personal struggles/problems');
    console.log('   - Still keep messages brief (under 15 words usually)');
    console.log('   - Show trust by opening up about family, school stress, etc.');
    console.log('   - NOT ready for IRL meetups yet (that\'s Phase 3+)');
    console.log('   - Voice notes only for verification, not casual chat');

    await prisma.$disconnect();
}

analyzePhase2().catch(console.error);
