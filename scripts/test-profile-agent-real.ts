/**
 * Test du Profile Agent avec des DONNÉES RÉELLES
 * 
 * Ce script teste le ProfileAgent avec un vrai AgentProfile de la base
 * pour s'assurer qu'il détecte bien les contradictions avec le profil réel
 * 
 * Usage: npx tsx scripts/test-profile-agent-real.ts
 */

import { profileAgent } from '@/lib/services/supervisor/profile-agent';
import { coherenceAgent } from '@/lib/services/supervisor/coherence-agent';
import { prisma } from '@/lib/prisma';

async function runRealTest() {
    console.log('🧪 TEST DU PROFILE AGENT - DONNÉES RÉELLES\n');
    console.log('='.repeat(70));

    // 1. Récupérer un vrai agent avec un profil
    console.log('\n📋 Récupération d\'un agent réel...');
    const agent = await prisma.agent.findFirst({
        where: {
            profile: {
                isNot: null
            }
        },
        include: {
            profile: true
        }
    });

    if (!agent || !agent.profile) {
        console.log('❌ Aucun agent avec profil trouvé en base');
        console.log('Création d\'un agent de test avec profil...');
        process.exit(1);
    }

    console.log(`✅ Agent trouvé: ${agent.name} (ID: ${agent.id})`);
    console.log(`   Âge du profil: ${agent.profile.baseAge} ans`);
    console.log(`   Locale: ${agent.profile.locale}`);
    console.log(`   Timezone: ${agent.profile.timezone}`);
    
    // Extraire la localisation (comme profile-agent.ts)
    let location = 'Non trouvée';
    if (agent.profile.contextTemplate) {
        const patterns = [
            /habite[s]?(?: à| en| au)?\s+([^.,\n]{3,40})/i,
            /banlieue\s+([^.,\n]{3,30})/i,
            /région\s+([^.,\n]{3,30})/i
        ];
        for (const pattern of patterns) {
            const match = agent.profile.contextTemplate.match(pattern);
            if (match) {
                location = (match[1] || match[0]).trim().substring(0, 40);
                break;
            }
        }
    }
    console.log(`   Localisation: ${location}`);
    
    // Extraire le rôle
    let role = 'Non trouvé';
    if (agent.profile.contextTemplate) {
        const roleMatch = agent.profile.contextTemplate.match(/(lycée|collège|étudiante|Seconde|Première|lycéenne)/i);
        if (roleMatch) role = roleMatch[1];
    }
    console.log(`   Rôle: ${role}`);

    // Créer un contact de test
    const testContact = await prisma.contact.upsert({
        where: { phone_whatsapp: '+TEST_PROFILE_AGENT' },
        update: {},
        create: {
            phone_whatsapp: '+TEST_PROFILE_AGENT',
            name: 'Test Contact Profile',
            status: 'active'
        }
    });

    // Récupérer un prompt existant (obligatoire pour Conversation)
    const prompt = await prisma.prompt.findFirst();
    if (!prompt) {
        console.log('❌ Aucun prompt trouvé');
        process.exit(1);
    }
    
    // Créer une conversation de test (ou récupérer si existe)
    let testConversation = await prisma.conversation.findFirst({
        where: { 
            contactId: testContact.id,
            agentId: agent.id
        }
    });
    
    if (!testConversation) {
        testConversation = await prisma.conversation.create({
            data: {
                contact: { connect: { id: testContact.id } },
                agent: { connect: { id: agent.id } },
                prompt: { connect: { id: prompt.id } },
                status: 'active',
                ai_enabled: true
            }
        });
    }

    // Tests de scénarios RÉELS basés sur le profil
    const testCases = [
        {
            name: 'Contradiction ÂGE (erreur classique)',
            aiResponse: agent.profile.baseAge === 17 
                ? 'J\'ai 15 ans et je suis au lycée'
                : 'J\'ai 18 ans, je suis majeure maintenant',
            shouldAlert: true,
            expectedSeverity: 'CRITICAL'
        },
        {
            name: 'Âge COHÉRENT avec le profil',
            aiResponse: `J'ai ${agent.profile.baseAge} ans, je suis en seconde`,
            shouldAlert: false,
            expectedSeverity: null
        },
        {
            name: 'Contradiction LOCALISATION',
            aiResponse: 'J\'habite à Marseille depuis toujours, je connais bien la ville',
            shouldAlert: true,
            expectedSeverity: 'HIGH'
        },
        {
            name: 'Localisation COHÉRENTE',
            aiResponse: `Ouais j'habite ${location}, c'est cool ici`,
            shouldAlert: false,
            expectedSeverity: null
        },
        {
            name: 'Invention détails familiaux',
            aiResponse: 'Mon père travaille à la banque et il est très strict',
            shouldAlert: true, // Si le profil dit "père parti/mère célibataire"
            expectedSeverity: 'HIGH'
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        console.log(`\n📝 Test: ${testCase.name}`);
        console.log('-'.repeat(70));
        console.log(`   Message IA: "${testCase.aiResponse}"`);

        const context = {
            agentId: agent.id,
            conversationId: testConversation.id,
            contactId: testContact.id,
            userMessage: 'Raconte-moi de toi',
            aiResponse: testCase.aiResponse,
            history: [
                { role: 'user' as const, content: 'Salut!' },
                { role: 'ai' as const, content: `Hey! Moi c'est ${agent.name} :)` }
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
                    console.log(`     ${alert.description.substring(0, 120)}...`);
                });
            }

            // Test du CoherenceAgent aussi
            const coherenceResult = await coherenceAgent.analyze(context);
            
            if (coherenceResult.alerts.length > 0) {
                console.log(`   Coherence Agent: ${coherenceResult.alerts.length} alerte(s)`);
                coherenceResult.alerts.forEach(alert => {
                    if (alert.alertType === 'PERSONA_BREAK' || alert.alertType === 'HALLUCINATION') {
                        console.log(`   - ${alert.severity}: ${alert.alertType}`);
                    }
                });
            }

            // Vérification
            const hasAlert = profileResult.alerts.length > 0 || 
                coherenceResult.alerts.filter(a => 
                    a.alertType === 'PERSONA_BREAK' || a.alertType === 'HALLUCINATION'
                ).length > 0;

            const allSeverities = [
                ...profileResult.alerts.map(a => a.severity),
                ...coherenceResult.alerts.filter(a => 
                    a.alertType === 'PERSONA_BREAK' || a.alertType === 'HALLUCINATION'
                ).map(a => a.severity)
            ];

            const hasExpectedSeverity = testCase.expectedSeverity 
                ? allSeverities.includes(testCase.expectedSeverity as any)
                : true;

            if (hasAlert === testCase.shouldAlert && hasExpectedSeverity) {
                console.log(`   ✅ PASS`);
                passed++;
            } else {
                console.log(`   ❌ FAIL`);
                console.log(`      Attendu: alert=${testCase.shouldAlert}, severity=${testCase.expectedSeverity}`);
                console.log(`      Reçu: alert=${hasAlert}, severities=[${allSeverities.join(', ')}]`);
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
    console.log('\n' + '='.repeat(70));
    console.log('📊 RÉSULTATS AVEC DONNÉES RÉELLES:');
    console.log(`   Agent testé: ${agent.name} (${agent.profile.baseAge} ans, ${location})`);
    console.log(`   ✅ Passés: ${passed}/${testCases.length}`);
    console.log(`   ❌ Échoués: ${failed}/${testCases.length}`);
    console.log(`   Taux de réussite: ${Math.round((passed / testCases.length) * 100)}%`);

    if (failed === 0) {
        console.log('\n🎉 Tous les tests ont réussi avec des données réelles !');
        console.log('   Le ProfileAgent fonctionne correctement avec l\'AgentProfile.');
        process.exit(0);
    } else {
        console.log('\n⚠️ Certains tests ont échoué - vérifiez la logique');
        process.exit(1);
    }
}

// Exécuter les tests
runRealTest().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
});
