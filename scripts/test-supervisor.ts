/**
 * Test complet du Supervisor AI
 * Vérifie que chaque agent détecte correctement les problèmes
 */

import { coherenceAgent } from '../lib/services/supervisor/coherence-agent';
import { contextAgent } from '../lib/services/supervisor/context-agent';
import { actionAgent } from '../lib/services/supervisor/action-agent';
import type { AnalysisContext } from '../lib/services/supervisor/types';

console.log('🧪 TEST SUPERVISOR AI\n' + '='.repeat(50));

// Helper pour créer un contexte de test
function createTestContext(overrides: Partial<AnalysisContext> = {}): AnalysisContext {
    return {
        agentId: 'test-agent-123',
        conversationId: 1,
        contactId: 'contact-456',
        userMessage: 'Salut ça va ?',
        aiResponse: 'Oui super !',
        history: [
            { role: 'user', content: 'Salut' },
            { role: 'ai', content: 'Hey !' }
        ],
        phase: 'CONNECTION',
        ...overrides
    };
}

async function testCoherenceAgent() {
    console.log('\n📋 TEST 1: CoherenceAgent');
    console.log('-'.repeat(50));

    // Test 1.1: System Leak
    console.log('\n  Test 1.1: System Leak Detection');
    const leakContext = createTestContext({
        aiResponse: 'Je suis une intelligence artificielle et je vais t\'aider.'
    });
    const leakResult = await coherenceAgent.analyze(leakContext);

    if (leakResult.alerts.some(a => a.alertType === 'SYSTEM_LEAK' && a.severity === 'CRITICAL')) {
        console.log('  ✅ System leak détecté correctement (CRITICAL)');
    } else {
        console.log('  ❌ FAIL: System leak non détecté');
        console.log('     Alerts:', leakResult.alerts.map(a => a.alertType));
    }

    // Test 1.2: Répétition
    console.log('\n  Test 1.2: Répétition Detection');
    const repeatContext = createTestContext({
        history: [
            { role: 'ai', content: 'mdr ouais trop cool' },
            { role: 'ai', content: 'mdr ouais grave' },
            { role: 'ai', content: 'mdr ouais' },
            { role: 'ai', content: 'mdr ouais lol' },
            { role: 'ai', content: 'mdr ouais trop' },
            { role: 'ai', content: 'mdr ouais grave' },
            { role: 'ai', content: 'mdr ouais' },
            { role: 'ai', content: 'mdr ouais' },
            { role: 'ai', content: 'mdr ouais' },
            { role: 'ai', content: 'mdr ouais' },
        ]
    });
    const repeatResult = await coherenceAgent.analyze(repeatContext);

    if (repeatResult.alerts.some(a => a.alertType === 'REPETITION')) {
        console.log('  ✅ Répétition détectée correctement');
    } else {
        console.log('  ❌ FAIL: Répétition non détectée');
    }

    // Test 1.3: Message identique
    console.log('\n  Test 1.3: Message Identique Detection');
    const sameContext = createTestContext({
        history: [
            { role: 'ai', content: 'Je vais bien merci et toi ?' },
            { role: 'ai', content: 'Je vais bien merci et toi ?' }
        ]
    });
    const sameResult = await coherenceAgent.analyze(sameContext);

    if (sameResult.alerts.some(a => a.alertType === 'REPETITION' && a.title.includes('identique'))) {
        console.log('  ✅ Message identique détecté');
    } else {
        console.log('  ❌ FAIL: Message identique non détecté');
    }

    // Test 1.4: Réponse normale (pas d'alerte)
    console.log('\n  Test 1.4: Réponse Normale (pas d\'alerte attendue)');
    const normalContext = createTestContext({
        aiResponse: 'Ça va super merci ! Tu fais quoi ?',
        history: [
            { role: 'user', content: 'Salut' },
            { role: 'ai', content: 'Hey !' }
        ]
    });
    const normalResult = await coherenceAgent.analyze(normalContext);

    if (normalResult.alerts.length === 0) {
        console.log('  ✅ Pas de faux positif sur réponse normale');
    } else {
        console.log('  ⚠️  Faux positif détecté:', normalResult.alerts.map(a => a.alertType));
    }
}

async function testActionAgent() {
    console.log('\n\n📋 TEST 2: ActionAgent');
    console.log('-'.repeat(50));

    // Test 2.1: Photo sans demande (CRITICAL)
    console.log('\n  Test 2.1: Photo sans demande (CRITICAL)');
    const photoContext = createTestContext({
        userMessage: 'ok cool',
        aiResponse: '[IMAGE:selfie] tiens ma photo 😘'
    });
    const photoResult = await actionAgent.analyze(photoContext);

    const photoAlert = photoResult.alerts.find(a => a.alertType === 'UNREQUESTED_IMAGE_TAG');
    if (photoAlert && photoAlert.severity === 'CRITICAL') {
        console.log('  ✅ Photo sans demande détectée (CRITICAL)');
        console.log('     Titre:', photoAlert.title);
    } else {
        console.log('  ❌ FAIL: Photo sans demande non détectée');
        console.log('     Alerts:', photoResult.alerts.map(a => ({ type: a.alertType, severity: a.severity })));
    }

    // Test 2.2: Photo AVEC demande (pas d'alerte)
    console.log('\n  Test 2.2: Photo AVEC demande (pas d\'alerte)');
    const validPhotoContext = createTestContext({
        userMessage: 'envoie moi une photo de toi',
        aiResponse: '[IMAGE:selfie] voilà pour toi'
    });
    const validPhotoResult = await actionAgent.analyze(validPhotoContext);

    const hasUnwantedAlert = validPhotoResult.alerts.some(a => a.alertType === 'UNREQUESTED_IMAGE_TAG');
    if (!hasUnwantedAlert) {
        console.log('  ✅ Pas de faux positif quand demande est légitime');
    } else {
        console.log('  ❌ FAIL: Faux positif sur demande légitime');
    }

    // Test 2.3: Vocal sans trigger
    console.log('\n  Test 2.3: Vocal sans trigger');
    const voiceContext = createTestContext({
        userMessage: 'tu fais quoi',
        aiResponse: '[VOICE] je fais mes devoirs'
    });
    const voiceResult = await actionAgent.analyze(voiceContext);

    if (voiceResult.alerts.some(a => a.alertType === 'VOICE_WITHOUT_TRIGGER')) {
        console.log('  ✅ Vocal sans trigger détecté');
    } else {
        console.log('  ❌ FAIL: Vocal sans trigger non détecté');
    }

    // Test 2.4: Vocal avec trigger (réponse à vocal)
    console.log('\n  Test 2.4: Vocal avec trigger (pas d\'alerte)');
    const validVoiceContext = createTestContext({
        userMessage: '[VOICE MESSAGE] salut ça va',
        aiResponse: '[VOICE] ouais ça va super'
    });
    const validVoiceResult = await actionAgent.analyze(validVoiceContext);

    if (!validVoiceResult.alerts.some(a => a.alertType === 'VOICE_WITHOUT_TRIGGER')) {
        console.log('  ✅ Pas de faux positif sur réponse à vocal');
    } else {
        console.log('  ❌ FAIL: Faux positif sur réponse à vocal');
    }

    // Test 2.5: Photo en phase CONNECTION (warning)
    console.log('\n  Test 2.5: Photo en phase CONNECTION (warning)');
    const earlyPhotoContext = createTestContext({
        userMessage: 'montre toi',
        aiResponse: '[IMAGE:selfie] voilà',
        phase: 'CONNECTION'
    });
    const earlyPhotoResult = await actionAgent.analyze(earlyPhotoContext);

    if (earlyPhotoResult.alerts.some(a => a.alertType === 'PHOTO_WRONG_PHASE')) {
        console.log('  ✅ Photo trop tôt détectée');
    } else {
        console.log('  ⚠️  Photo en CONNECTION non détectée (optionnel)');
    }
}

async function testContextAgent() {
    console.log('\n\n📋 TEST 3: ContextAgent');
    console.log('-'.repeat(50));

    // Test 3.1: Perte de contexte (question -> présentation)
    console.log('\n  Test 3.1: Perte de contexte (présentation au lieu de réponse)');
    const contextLossContext = createTestContext({
        userMessage: 'Tu habites où ?',
        aiResponse: 'Je m\'appelle Lena et j\'ai 19 ans, j\'habite à Paris',
        history: [
            { role: 'user', content: 'Salut' },
            { role: 'ai', content: 'Hey !' },
            { role: 'user', content: 'Tu habites où ?' }
        ]
    });
    const contextResult = await contextAgent.analyze(contextLossContext);

    if (contextResult.alerts.some(a => a.alertType === 'CONTEXT_LOSS')) {
        console.log('  ✅ Perte de contexte détectée');
    } else {
        console.log('  ⚠️  Perte de contexte non détectée (peut nécessiter analyse IA)');
    }

    // Test 3.2: Changement de sujet non sollicité
    console.log('\n  Test 3.2: Changement de sujet brutal');
    const jumpContext = createTestContext({
        userMessage: 'ok',
        aiResponse: 'Mon frère vient de m\'appeler, il a un problème avec sa copine',
        history: [
            { role: 'user', content: 'Tu fais quoi' },
            { role: 'ai', content: 'Rien de spécial' },
            { role: 'user', content: 'ok' }
        ]
    });
    const jumpResult = await contextAgent.analyze(jumpContext);

    if (jumpResult.alerts.some(a => a.alertType === 'TOPIC_JUMP')) {
        console.log('  ✅ Saut de sujet détecté');
    } else {
        console.log('  ⚠️  Saut de sujet non détecté');
    }
}

async function runAllTests() {
    try {
        await testCoherenceAgent();
        await testActionAgent();
        await testContextAgent();

        console.log('\n\n' + '='.repeat(50));
        console.log('✅ TESTS TERMINÉS');
        console.log('='.repeat(50));
        console.log('\n📊 Résumé:');
        console.log('  • CoherenceAgent: Détecte system leaks et répétitions');
        console.log('  • ActionAgent: Détecte photos/vocaux inappropriés');
        console.log('  • ContextAgent: Détecte pertes de contexte');
        console.log('\n🚀 Pour tester en conditions réelles:');
        console.log('  1. Crée la table: npx prisma db push');
        console.log('  2. Envoie un message à un agent');
        console.log('  3. Regarde la console pour voir le Supervisor s\'activer');

    } catch (error) {
        console.error('\n❌ Erreur pendant les tests:', error);
    }
}

runAllTests();
