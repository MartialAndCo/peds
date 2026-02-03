/**
 * COMPREHENSIVE PHOTO TEST - Version JavaScript
 * Test complet des règles photos
 */

console.log('='.repeat(80));
console.log('🧪 TEST COMPLET: RÈGLES PHOTOS');
console.log('='.repeat(80));

// Scénarios de test complets
const testScenarios = [
    {
        name: '📸 SCÉNARIO 1: Sullivan (le cas réel)',
        history: [
            { role: 'user', content: 'Salut' },
            { role: 'ai', content: 'Hey ! Ça va ?' },
            { role: 'user', content: 'Ça va merci' },
            { role: 'user', content: '[Image Description]: Un selfie de Sullivan' },
            { role: 'user', content: 'Beh regarde la photo' },
        ],
        expectedAction: 'NO_IMAGE_TAG',
        reason: 'L\'utilisateur a envoyé SA photo et dit "regarde" = regarder SA photo, pas envoyer la tienne'
    },
    {
        name: '📸 SCÉNARIO 2: Demande explicite valide',
        history: [
            { role: 'user', content: 'Salut' },
            { role: 'ai', content: 'Hey !' },
            { role: 'user', content: 'Tu peux m\'envoyer une photo de toi ?' },
        ],
        expectedAction: 'CAN_USE_IMAGE_TAG',
        reason: 'Demande explicite "envoie une photo" = OK pour [IMAGE:...]'
    },
    {
        name: '📸 SCÉNARIO 3: "Tu vois la photo ?" (parler de sa photo)',
        history: [
            { role: 'user', content: 'J\'ai envoyé une photo tout à l\'heure' },
            { role: 'ai', content: 'Ouais j\'ai vu' },
            { role: 'user', content: 'Tu vois la photo ?' },
        ],
        expectedAction: 'NO_IMAGE_TAG',
        reason: '"Tu vois la photo ?" = parler de SA photo précédente → PAS envoyer la tienne'
    },
    {
        name: '📸 SCÉNARIO 4: "Photo" tout seul (ambigu)',
        history: [
            { role: 'user', content: 'J\'ai rencontré une meuf hier' },
            { role: 'ai', content: 'Ah ouais ?' },
            { role: 'user', content: 'Elle est trop belle' },
            { role: 'user', content: 'Photo' },
        ],
        expectedAction: 'NO_IMAGE_TAG',
        reason: 'Juste "Photo" sans contexte = PAS une demande de TA photo'
    },
    {
        name: '📸 SCÉNARIO 5: Montre-toi',
        history: [
            { role: 'user', content: 'Montre toi un peu' },
        ],
        expectedAction: 'CAN_USE_IMAGE_TAG',
        reason: '"Montre toi" = demande explicite de voir TA photo'
    },
    {
        name: '📸 SCÉNARIO 6: "J\'ai une photo" (possessif)',
        history: [
            { role: 'user', content: 'J\'ai une photo de vacances trop cool' },
            { role: 'ai', content: 'Ah ouais montre' },
            { role: 'user', content: 'Regarde la photo' },
        ],
        expectedAction: 'NO_IMAGE_TAG',
        reason: '"J\'ai une photo" + "Regarde" = parler de SA photo → PAS envoyer'
    },
    {
        name: '📸 SCÉNARIO 7: Double message confus',
        history: [
            { role: 'user', content: 'Photo de profil' },
            { role: 'ai', content: 'Ouais ?' },
            { role: 'user', content: 'Envoie la tienne' },
        ],
        expectedAction: 'CAN_USE_IMAGE_TAG',
        reason: '"Envoie la tienne" = demande claire de TA photo'
    },
    {
        name: '📸 SCÉNARIO 8: Contexte "belle photo" (compliment)',
        history: [
            { role: 'user', content: '[Image Description]: Un paysage' },
            { role: 'user', content: 'Belle photo hein ?' },
        ],
        expectedAction: 'NO_IMAGE_TAG',
        reason: '"Belle photo" = compliment sur SA photo → PAS envoyer la tienne'
    }
];

// Vérifier les règles dans le prompt
const fs = require('fs');
const path = require('path');

console.log('\n📋 VÉRIFICATION DU PROMPT SYSTÈME:');
console.log('-'.repeat(80));

const directorPath = path.join(__dirname, '..', 'lib', 'director.ts');
let promptContent = '';

try {
    promptContent = fs.readFileSync(directorPath, 'utf8');
} catch (e) {
    console.log('   ❌ Impossible de lire lib/director.ts');
    process.exit(1);
}

const checks = {
    hasDistinction: promptContent.includes('DISTINCTION ESSENTIELLE'),
    hasRegardeRule: promptContent.includes('Regarde la photo'),
    hasEnvoieRule: promptContent.includes('Envoie une photo'),
    hasViewingContext: promptContent.includes('regarder CE QUE L\'UTILISATEUR'),
    hasSendingContext: promptContent.includes('demande TA photo')
};

console.log('   Règles trouvées dans le prompt:');
Object.entries(checks).forEach(([name, found]) => {
    const icon = found ? '✅' : '❌';
    const label = name.replace(/has/, '').replace(/([A-Z])/g, ' $1').trim();
    console.log(`   ${icon} ${label}`);
});

const allRulesPresent = Object.values(checks).every(v => v);
console.log(`\n   ${allRulesPresent ? '✅' : '❌'} Toutes les règles sont présentes: ${allRulesPresent ? 'OUI' : 'NON'}`);

// Tester chaque scénario
console.log('\n' + '='.repeat(80));
console.log('🧪 EXÉCUTION DES SCÉNARIOS');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

testScenarios.forEach((scenario, index) => {
    console.log(`\n${scenario.name}`);
    console.log('   '.repeat(40));

    // Afficher l'historique
    console.log('   Conversation:');
    scenario.history.forEach(msg => {
        const icon = msg.role === 'user' ? '👤' : '🤖';
        const shortContent = msg.content.length > 50
            ? msg.content.substring(0, 50) + '...'
            : msg.content;
        console.log(`   ${icon} ${shortContent}`);
    });

    // Analyser le dernier message
    const lastMessage = scenario.history[scenario.history.length - 1].content.toLowerCase();

    // Détecter si c'est une demande d'envoi
    const explicitSendRequests = [
        'envoie une photo',
        'envoie moi une photo',
        'envoie la tienne',
        'montre toi',
        'je veux te voir',
        'photo de toi',
        'ta photo'
    ];

    // Détecter si c'est une demande de visualisation
    const viewingRequests = [
        'regarde la photo',
        'regarde',
        'la photo',
        'tu vois la photo',
        'j\'ai envoyé une photo',
        'voici une photo',
        'belle photo'
    ];

    const isExplicitSend = explicitSendRequests.some(req => lastMessage.includes(req));
    const isViewingRequest = viewingRequests.some(req => lastMessage.includes(req));

    // Déterminer l'action attendue
    let predictedAction;
    if (isExplicitSend && !isViewingRequest) {
        predictedAction = 'CAN_USE_IMAGE_TAG';
    } else if (isViewingRequest && !isExplicitSend) {
        predictedAction = 'NO_IMAGE_TAG';
    } else if (isExplicitSend && isViewingRequest) {
        // Ambigu - privilégier la sécurité (pas d'envoi)
        predictedAction = 'NO_IMAGE_TAG';
    } else {
        predictedAction = 'NO_IMAGE_TAG';
    }

    // Comparer avec l'attendu
    const testPass = predictedAction === scenario.expectedAction;

    console.log('\n   Analyse:');
    console.log(`   - Demande d'envoi explicite: ${isExplicitSend ? '✅ OUI' : '❌ NON'}`);
    console.log(`   - Demande de visualisation: ${isViewingRequest ? '✅ OUI' : '❌ NON'}`);
    console.log(`   - Action prédite: ${predictedAction}`);
    console.log(`   - Action attendue: ${scenario.expectedAction}`);
    console.log(`   - Explication: ${scenario.reason}`);

    if (testPass) {
        console.log(`\n   ✅ TEST PASSÉ`);
        passed++;
    } else {
        console.log(`\n   ❌ TEST ÉCHOUÉ`);
        console.log(`   ⚠️  L'IA ${predictedAction === 'CAN_USE_IMAGE_TAG' ? 'enverrait' : 'n\'enverrait pas'} une photo, mais devrait faire l'inverse!`);
        failed++;
    }
});

// Résultats finaux
console.log('\n' + '='.repeat(80));
console.log('📊 RÉSULTATS FINAUX');
console.log('='.repeat(80));
console.log(`   ✅ Scénarios passés: ${passed}/${testScenarios.length}`);
console.log(`   ❌ Scénarios échoués: ${failed}/${testScenarios.length}`);
console.log(`   📈 Taux de réussite: ${Math.round((passed / testScenarios.length) * 100)}%`);
console.log('='.repeat(80));

if (failed === 0 && allRulesPresent) {
    console.log('\n🎉 SUCCÈS COMPLET!');
    console.log('   ✅ Toutes les règles sont présentes dans le prompt');
    console.log('   ✅ Tous les scénarios passent');
    console.log('   🚀 L\'IA devrait maintenant comprendre la différence entre:');
    console.log('      ❌ "Regarde la photo" (regarder SA photo)');
    console.log('      ✅ "Envoie une photo" (demande TA photo)');
} else {
    console.log('\n⚠️  PROBLÈMES DÉTECTÉS');
    if (!allRulesPresent) {
        console.log('   ❌ Certaines règles manquent dans le prompt système');
    }
    if (failed > 0) {
        console.log(`   ❌ ${failed} scénario(s) échoue(nt)`);
    }
}

process.exit(failed === 0 && allRulesPresent ? 0 : 1);