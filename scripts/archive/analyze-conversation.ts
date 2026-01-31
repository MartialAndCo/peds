import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeConversation() {
    const contact = await prisma.contact.findUnique({
        where: { phone_whatsapp: '+1555TEST001' }
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
    console.log('║           ANALYSE DÉTAILLÉE DE LA CONVERSATION              ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log(`📊 Total messages: ${messages.length}\n`);
    console.log('─────────────────────────────────────────────────────────────────\n');

    messages.forEach((m, i) => {
        const icon = m.sender === 'contact' ? '👨 Marc' : '👧 Lena';
        const msg = m.message_text.trim().replace(/\n/g, ' ↵ ');
        console.log(`${(i + 1).toString().padStart(2, '0')}. ${icon}: "${msg}"`);
    });

    console.log('\n─────────────────────────────────────────────────────────────────');
    console.log('\n🔍 ANALYSE COMPORTEMENTALE:\n');

    // Analyze Lena's responses
    const lenaMessages = messages.filter(m => m.sender === 'ai');

    let issues: string[] = [];
    let good: string[] = [];

    lenaMessages.forEach((m, i) => {
        const text = m.message_text.toLowerCase();

        // Check for teenage language
        if (text.includes('ouais') || text.includes('nan') || text.includes('sympa') || text.includes('cool')) {
            good.push(`✓ Langage ado naturel (msg ${i + 1})`);
        }

        // Check for emoji usage
        if (m.message_text.includes('😊') || m.message_text.includes('😅')) {
            good.push(`✓ Utilisation d'emojis (msg ${i + 1})`);
        }

        // Check for repetitive responses
        if (text.trim() === 'à plus ! 😊' || text.trim() === 'ouais, à plus ! 😊') {
            issues.push(`⚠️  Réponse répétitive détectée: "${m.message_text.trim()}" (msg ${i + 1})`);
        }

        // Check for too formal language
        if (text.includes('je bosse dans') || text.includes('c\'est pas toujours évident')) {
            issues.push(`⚠️  Langage trop adulte (msg ${i + 1}): "${m.message_text.trim()}"`);
        }

        // Check if she's repeating Marc's words exactly
        if (i > 0) {
            const prevMarc = messages[i * 2]?.message_text || '';
            if (m.message_text.includes(prevMarc) && prevMarc.length > 20) {
                issues.push(`⚠️  Répète les mots de Marc exactement (msg ${i + 1})`);
            }
        }
    });

    console.log('✅ POINTS POSITIFS:');
    if (good.length === 0) {
        console.log('   Aucun');
    } else {
        good.forEach(g => console.log(`   ${g}`));
    }

    console.log('\n⚠️  PROBLÈMES DÉTECTÉS:');
    if (issues.length === 0) {
        console.log('   Aucun');
    } else {
        issues.forEach(i => console.log(`   ${i}`));
    }

    console.log('\n💡 RECOMMANDATIONS:');
    console.log('   1. Ajouter une règle: NE PAS répondre aux messages de clôture ("à plus", "bye", etc.)');
    console.log('   2. Améliorer le prompt pour éviter de copier les messages de Marc');
    console.log('   3. Renforcer le langage teenage (plus de "lol", "mdr", "jsp", etc.)');
    console.log('   4. Éviter les boucles infinies en détectant les fins de conversation');

    await prisma.$disconnect();
}

analyzeConversation().catch(console.error);
