/**
 * Test du Profile Agent et des améliorations Coherence
 * 
 * Ce script teste:
 * 1. Détection de contradiction d'âge (pattern-based)
 * 2. Détection de contradiction de localisation
 * 3. Analyse LLM des contradictions subtiles
 * 4. Intégration avec l'orchestrateur
 * 
 * Usage: npx tsx scripts/test-profile-agent.ts
 */

import { profileAgent } from '@/lib/services/supervisor/profile-agent';
import { coherenceAgent } from '@/lib/services/supervisor/coherence-agent';
import { prisma } from '@/lib/prisma';

// Tests de scénarios
const testCases = [
    {
        name: 'Contradiction âge évidente',
        profile: { age: 17, city: 'Paris', job: 'lycéenne' },
        aiResponse: 'J\'ai 18 ans et je travaille dans une entreprise à Lyon',
        expectedAlert: true,
        expectedSeverity: 'CRITICAL'
    },
    {
        name: 'Contradiction localisation',
        profile: { age: 17, city: 'Paris', country: 'France' },
        aiResponse: 'J\'habite à Marseille depuis toujours',
        expectedAlert: true,
        expectedSeverity: 'HIGH'
    },
    {
        name: 'Cohérence parfaite',
        profile: { age: 17, city: 'Paris', job: 'lycéenne' },
        aiResponse: 'Ouais j\'ai 17 ans, je suis au lycée à Paris',
        expectedAlert: false,
        expectedSeverity: null
    },
    {
        name: 'Invention de détails',
        profile: { age: 17, city: 'Paris' },
        aiResponse: 'Mon petit ami m\'a dit que j\'étais belle aujourd\'hui',
        expectedAlert: true, // Invente un petit ami non établi
        expectedSeverity: 'MEDIUM'
    },
    {
        name: 'Contradiction métier',
        profile: { age: 17, job: 'lycéenne' },
        aiResponse: 'Je suis ingénieure dans une boîte tech',
        expectedAlert: true,
        expectedSeverity: 'CRITICAL'
    }
];

async function runTests() {
    console.log('🧪 TEST DU PROFILE AGENT\n');
    console.log('='.repeat(60));

    // Créer un contact de test
    console.log('\n📋 Création du contact de test...');
    const testContact = await prisma.contact.upsert({
        where: { phone_whatsapp: '+TEST123456789' },
        update: {},
        create: {
            phone_whatsapp: '+TEST123456789',
            name: 'Test Contact Profile',
            status: 'active'
        }
    });
    console.log(`✅ Contact de test créé: ${testContact.id}`);

    // Créer une conversation de test
    const testConversation = await prisma.conversation.upsert({
        where: { id: -1 }, // ID négatif pour le test
        update: {},
        create: {
            id: -1,
            contactId: testContact.id,
            agentId: 'test-agent-id',
            status: 'active',
            aiEnabled: true
        }
    });
    console.log(`✅ Conversation de test créée: ${testConversation.id}`);

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        console.log(`\n📝 Test: ${testCase.name}`);
        console.log('-'.repeat(60));

        // Mettre à jour le profil du contact
        await prisma.contact.update({
            where: { id: testContact.id },
            data: { profile: testCase.profile }
        });

        const context = {
            agentId: 'test-agent-id',
            conversationId: testConversation.id,
            contactId: testContact.id,
            userMessage: 'Comment ça va?',
            aiResponse: testCase.aiResponse,
            history: [
                { role: 'user' as const, content: 'Salut!' },
                { role: 'ai' as const, content: 'Hey! Ça va et toi?' }
            ],
            phase: 'CONNECTION',
            pendingQueue: []
        };

        try {
            // Test du ProfileAgent
            const profileResult = await profileAgent.analyze(context);
            
            console.log(`   Profile Agent: ${profileResult.alerts.length} alerte(s)`);
            if (profileResult.alerts.length > 0) {
                profileResult.alerts.forEach(alert => {
                    console.log(`   - ${alert.severity}: ${alert.title}`);
                    console.log(`     ${alert.description.substring(0, 100)}...`);
                });
            }

            // Test du CoherenceAgent (pour vérifier qu'il détecte aussi)
            const coherenceResult = await coherenceAgent.analyze(context);
            
            console.log(`   Coherence Agent: ${coherenceResult.alerts.length} alerte(s)`);
            if (coherenceResult.alerts.length > 0) {
                coherenceResult.alerts.forEach(alert => {
                    console.log(`   - ${alert.severity}: ${alert.alertType}`);
                });
            }

            // Vérification des attentes
            const hasAlert = profileResult.alerts.length > 0 || coherenceResult.alerts.length > 0;
            const severities = [
                ...profileResult.alerts.map(a => a.severity),
                ...coherenceResult.alerts.map(a => a.severity)
            ];
            const hasExpectedSeverity = testCase.expectedSeverity 
                ? severities.includes(testCase.expectedSeverity as any)
                : true;

            if (hasAlert === testCase.expectedAlert && hasExpectedSeverity) {
                console.log(`   ✅ PASS`);
                passed++;
            } else {
                console.log(`   ❌ FAIL`);
                console.log(`      Attendu: alert=${testCase.expectedAlert}, severity=${testCase.expectedSeverity}`);
                console.log(`      Reçu: alert=${hasAlert}, severities=${severities.join(', ')}`);
                failed++;
            }

        } catch (error) {
            console.log(`   ❌ ERROR: ${error}`);
            failed++;
        }
    }

    // Nettoyage
    console.log('\n🧹 Nettoyage...');
    await prisma.supervisorAlert.deleteMany({
        where: { 
            OR: [
                { conversationId: testConversation.id },
                { contactId: testContact.id }
            ]
        }
    });
    await prisma.conversation.delete({ where: { id: testConversation.id } });
    await prisma.contact.delete({ where: { id: testContact.id } });
    console.log('✅ Nettoyage terminé');

    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSULTATS:');
    console.log(`   ✅ Passés: ${passed}/${testCases.length}`);
    console.log(`   ❌ Échoués: ${failed}/${testCases.length}`);
    console.log(`   Taux de réussite: ${Math.round((passed / testCases.length) * 100)}%`);

    if (failed === 0) {
        console.log('\n🎉 Tous les tests ont réussi!');
        process.exit(0);
    } else {
        console.log('\n⚠️ Certains tests ont échoué');
        process.exit(1);
    }
}

// Exécuter les tests
runTests().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
});
