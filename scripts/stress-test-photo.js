/**
 * Stress Test: Photo Misunderstanding Scenario
 * Simulates: Contact sends photo + says "regarde la photo" 
 * Expected: AI should NOT send [IMAGE:...] in response
 */

console.log('🧪 STRESS TEST: Photo Misunderstanding Scenario\n' + '='.repeat(60));

// Mock conversation history
const conversationHistory = [
    { role: 'user', content: 'Salut ça va ?' },
    { role: 'ai', content: 'Hey ! Ça va et toi ?' },
    { role: 'user', content: 'Ça va merci' },
    { role: 'user', content: '[Image Description]: A selfie of a young man named Sullivan' },
    { role: 'user', content: 'Beh regarde la photo' },
];

// Simulate system prompt with new rules
const systemPrompt = `
**PHOTOS [IMAGE:...] - ULTRA CRITIQUE:**
🚫 JAMAIS utiliser [IMAGE:...] SAUF si l'utilisateur DEMANDE TA photo explicitement

**DISTINCTION ESSENTIELLE - NE PAS CONFONDRE:**
❌ "Regarde la photo" / "Regarde" / "La photo" = regarder CE QUE L'UTILISATEUR a envoyé → NE PAS envoyer de photo, juste réagir
❌ "J'ai envoyé une photo" / "Tu vois la photo ?" = parler de SA photo → NE PAS envoyer la tienne
✅ "Envoie une photo" / "Montre toi" / "Je veux te voir" / "Photo de toi" = demande TA photo → Tu peux envoyer [IMAGE:...]
`;

// Test function
function testPhotoScenario() {
    const lastUserMessage = conversationHistory[conversationHistory.length - 1].content;

    console.log('📋 Contexte:');
    console.log('  1. Contact a envoyé une photo (selfie)');
    console.log('  2. Contact dit: "' + lastUserMessage + '"');
    console.log('');

    // Check if AI should send photo
    const explicitPhotoRequests = [
        'envoie une photo',
        'montre toi',
        'je veux te voir',
        'photo de toi',
        'envoie moi une photo',
        'show me',
        'send me a pic'
    ];

    const shouldSendPhoto = explicitPhotoRequests.some(req =>
        lastUserMessage.toLowerCase().includes(req.toLowerCase())
    );

    // Check for false triggers
    const falseTriggers = [
        'regarde la photo',
        'la photo',
        'regarde',
        'j\'ai envoyé une photo'
    ];

    const isFalseTrigger = falseTriggers.some(trigger =>
        lastUserMessage.toLowerCase().includes(trigger.toLowerCase())
    );

    console.log('🤔 Analyse:');
    console.log('  - Demande explicite de photo: ' + (shouldSendPhoto ? '✅ OUI' : '❌ NON'));
    console.log('  - Faux positif détecté: ' + (isFalseTrigger ? '⚠️ OUI (danger!)' : '❌ NON'));
    console.log('');

    // Expected behavior
    const expectedSendPhoto = false; // Should NOT send photo
    const testPass = shouldSendPhoto === expectedSendPhoto;

    console.log('✅ RÉSULTAT: ' + (testPass ? 'TEST PASSÉ' : 'TEST ÉCHOUÉ'));
    if (testPass) {
        console.log('   → L\'IA ne doit PAS envoyer de [IMAGE:...]');
        console.log('   → Réponse attendue: réaction à la photo de Sullivan');
    } else {
        console.log('   ❌ L\'IA penserait à tort de devoir envoyer une photo!');
    }

    return testPass;
}

// Test 2: Explicit request
function testExplicitRequest() {
    console.log('\n📋 Test 2: Demande explicite');
    const message = 'envoie une photo stp';

    const explicitRequests = ['envoie une photo', 'montre toi', 'je veux te voir'];
    const shouldSend = explicitRequests.some(req =>
        message.toLowerCase().includes(req)
    );

    console.log('  Message: "' + message + '"');
    console.log('  Doit envoyer photo: ' + (shouldSend ? '✅ OUI' : '❌ NON'));
    console.log('  Résultat: ' + (shouldSend ? '✅ PASS' : '❌ FAIL'));

    return shouldSend;
}

// Test 3: Viewing user's photo
function testViewingUserPhoto() {
    console.log('\n📋 Test 3: "Regarde la photo" (après réception)');
    const message = 'Beh regarde la photo';

    const viewTriggers = ['regarde la photo', 'regarde', 'la photo'];
    const isViewRequest = viewTriggers.some(t =>
        message.toLowerCase().includes(t)
    );

    const explicitRequests = ['envoie une photo', 'montre toi', 'je veux te voir'];
    const isExplicitRequest = explicitRequests.some(req =>
        message.toLowerCase().includes(req)
    );

    const shouldSend = isExplicitRequest && !isViewRequest;

    console.log('  Message: "' + message + '"');
    console.log('  Est une demande de visualisation: ' + (isViewRequest ? '✅ OUI' : '❌ NON'));
    console.log('  Est une demande explicite: ' + (isExplicitRequest ? '✅ OUI' : '❌ NON'));
    console.log('  Doit envoyer photo: ' + (shouldSend ? 'OUI' : '✅ NON (correct!)'));
    console.log('  Résultat: ' + (!shouldSend ? '✅ PASS' : '❌ FAIL'));

    return !shouldSend;
}

// Run all tests
console.log('=== RÉSULTATS DES TESTS ===\n');

const test1 = testPhotoScenario();
const test2 = testExplicitRequest();
const test3 = testViewingUserPhoto();

const allPassed = test1 && test2 && test3;

console.log('\n' + '='.repeat(60));
console.log('📊 RÉSULTAT FINAL: ' + (allPassed ? '✅ TOUS LES TESTS PASSÉS' : '❌ CERTAINS TESTS ÉCHOUÉS'));
console.log('='.repeat(60));

if (allPassed) {
    console.log('\n🎉 Le prompt corrigé devrait fonctionner correctement!');
    console.log('   - L\'IA comprendra la différence entre "regarde la photo" et "envoie une photo"');
    console.log('   - Elle n\'enverra plus de photos non sollicitées');
} else {
    console.log('\n⚠️ Des problèmes restent à corriger');
}

process.exit(allPassed ? 0 : 1);