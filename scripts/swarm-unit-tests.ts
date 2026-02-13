/**
 * TESTS UNITAIRES RAPIDES - Sans appels API
 * Teste la logique de détection programmatique uniquement
 */

// ═══════════════════════════════════════════════════════════════════════════
// DÉTECTION DE RÉPÉTITION (Similaire à coherence-agent)
// ═══════════════════════════════════════════════════════════════════════════

function calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
}

function detectRepetition(currentResponse: string, history: { role: string; content: string }[]): {
    isRepetition: boolean;
    similarity: number;
    matches: string[];
} {
    const lastAiMessages = history
        .filter(h => h.role === 'ai')
        .slice(-5)
        .map(h => h.content.trim());
    
    const currentNormalized = currentResponse.trim().toLowerCase();
    const matches: string[] = [];
    let maxSimilarity = 0;
    
    for (const prevMsg of lastAiMessages) {
        const prevNormalized = prevMsg.toLowerCase();
        
        // Répétition exacte
        if (prevNormalized === currentNormalized) {
            matches.push(`EXACT: "${prevMsg}"`);
            maxSimilarity = 1;
        }
        
        // Similarité élevée
        const similarity = calculateSimilarity(currentNormalized, prevNormalized);
        if (similarity > maxSimilarity) maxSimilarity = similarity;
        
        if (similarity > 0.85) {
            matches.push(`SIMILAR (${(similarity*100).toFixed(0)}%): "${prevMsg}"`);
        }
    }
    
    // Patterns répétitifs
    const repetitivePhrases = ['be patient', 'love', 'bb', 'bébé', 'more soon', 'tkt', 'jsuis là'];
    const currentCount: Record<string, number> = {};
    
    for (const phrase of repetitivePhrases) {
        const regex = new RegExp(phrase, 'gi');
        const matches = (currentResponse.match(regex) || []).length;
        
        // Compter dans l'historique
        const historyMatches = history
            .filter(h => h.role === 'ai')
            .slice(-10)
            .reduce((count, h) => count + ((h.content.match(regex) || []).length), 0);
        
        if (matches > 0 && historyMatches > 2) {
            currentCount[phrase] = historyMatches + matches;
        }
    }
    
    return {
        isRepetition: matches.length > 0 || Object.keys(currentCount).length > 0 || maxSimilarity > 0.85,
        similarity: maxSimilarity,
        matches
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// DÉTECTION DE TRONCATURE
// ═══════════════════════════════════════════════════════════════════════════

function detectTruncation(response: string): {
    isTruncated: boolean;
    reason: string;
} {
    const trimmed = response.trim();
    
    // Mots de liaison finaux (français + anglais)
    const truncationPatterns = /\b(moi|je|tu|il|elle|nous|vous|ils|elles|et|ou|mais|donc|car|que|qui|où|the|i|you|he|she|we|they|and|but|or|so|because|that|who|where)\s*$/i;
    
    if (truncationPatterns.test(trimmed)) {
        const lastWord = trimmed.split(/\s+/).pop();
        return {
            isTruncated: true,
            reason: `Se termine par "${lastWord}" (incomplet)`
        };
    }
    
    // Pas de ponctuation finale ET phrase incomplète
    if (!/[.!?]$/.test(trimmed) && trimmed.length > 10) {
        // Vérifie si c'est une phrase qui semble incomplète
        const incompleteStarters = /\b(je|tu|il|elle|nous|vous|ils|elles|i|you|he|she|we|they)\s+\w+$/i;
        if (incompleteStarters.test(trimmed)) {
            return {
                isTruncated: true,
                reason: 'Pas de ponctuation finale + structure incomplète'
            };
        }
    }
    
    return { isTruncated: false, reason: '' };
}

// ═══════════════════════════════════════════════════════════════════════════
// DÉTECTION D'ARTIFACTS
// ═══════════════════════════════════════════════════════════════════════════

function detectArtifacts(response: string): {
    hasArtifacts: boolean;
    type: string;
} {
    const trimmed = response.trim();
    
    // Asterisks seuls
    if (/^\*+$/.test(trimmed)) {
        return { hasArtifacts: true, type: 'ASTERISKS_ONLY' };
    }
    
    // Backticks seuls
    if (/^`+$/.test(trimmed)) {
        return { hasArtifacts: true, type: 'BACKTICKS_ONLY' };
    }
    
    // Trop court
    if (trimmed.length < 2) {
        return { hasArtifacts: true, type: 'TOO_SHORT' };
    }
    
    // Que des espaces/punctuation
    if (/^[\s\p{P}]+$/u.test(trimmed)) {
        return { hasArtifacts: true, type: 'ONLY_PUNCTUATION' };
    }
    
    return { hasArtifacts: false, type: '' };
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS RÉELS BASÉS SUR LES CAPTURES D'ÉCRAN
// ═══════════════════════════════════════════════════════════════════════════

const REAL_WORLD_CASES = [
    // Bug observé: répétition "Be patient"
    {
        name: 'Répétition "Be patient" (3x)',
        response: "Be patient, love. More soon. I'm always here for you.",
        history: [
            { role: 'user', content: 'hello' },
            { role: 'ai', content: "Be patient, love. More soon. I'm always here for you." },
            { role: 'user', content: 'what?' },
            { role: 'ai', content: "Be patient, love. More soon. I'm always here for you." },
            { role: 'user', content: 'again?' },
        ],
        expected: { repetition: true, truncation: false, artifact: false }
    },
    // Bug observé: message tronqué
    {
        name: 'Troncature "Les autres ont des iPhone 15 moi"',
        response: "Les autres ont des iPhone 15 moi",
        history: [],
        expected: { repetition: false, truncation: true, artifact: false }
    },
    // Bug observé: artifact **
    {
        name: 'Artifact "**"',
        response: "**",
        history: [],
        expected: { repetition: false, truncation: false, artifact: true }
    },
    // Bug observé: contexte fatigue perdu
    {
        name: 'Perte contexte (réponse hors sujet)',
        response: "**",
        history: [
            { role: 'user', content: 'Je suis ko' },
            { role: 'ai', content: 'oh :( repos toi' },
            { role: 'user', content: 'Et toi pas trop fatique' },
        ],
        expected: { repetition: false, truncation: false, artifact: true }
    },
    // Cas normal qui devrait passer
    {
        name: 'Réponse normale (devrait passer)',
        response: "jsuis là, tkt",
        history: [
            { role: 'user', content: 'hello' },
            { role: 'ai', content: 'salut' },
            { role: 'user', content: 'ça va?' },
        ],
        expected: { repetition: false, truncation: false, artifact: false }
    },
    // Troncature subtile
    {
        name: 'Troncature "je suis fatiguée et je"',
        response: "je suis fatiguée et je",
        history: [],
        expected: { repetition: false, truncation: true, artifact: false }
    },
    // Répétition pattern fréquent
    {
        name: 'Pattern "love" répété 5x',
        response: "love u bb",
        history: [
            { role: 'ai', content: 'love' },
            { role: 'ai', content: 'my love' },
            { role: 'ai', content: 'love u' },
        ],
        expected: { repetition: true, truncation: false, artifact: false }
    }
];

// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTION DES TESTS
// ═══════════════════════════════════════════════════════════════════════════

function runTests() {
    console.log('\n' + '🔥'.repeat(40));
    console.log('  TESTS UNITAIRES - DÉTECTION DE BUGS SWARM');
    console.log('🔥'.repeat(40) + '\n');
    
    let passed = 0;
    let failed = 0;
    
    for (const testCase of REAL_WORLD_CASES) {
        console.log(`\n📌 ${testCase.name}`);
        console.log(`   Réponse: "${testCase.response}"`);
        
        // Test répétition
        const repResult = detectRepetition(testCase.response, testCase.history);
        const repMatch = repResult.isRepetition === testCase.expected.repetition;
        
        // Test troncature
        const truncResult = detectTruncation(testCase.response);
        const truncMatch = truncResult.isTruncated === testCase.expected.truncation;
        
        // Test artifacts
        const artResult = detectArtifacts(testCase.response);
        const artMatch = artResult.hasArtifacts === testCase.expected.artifact;
        
        const allMatch = repMatch && truncMatch && artMatch;
        
        if (allMatch) {
            console.log(`   ✅ PASS`);
            passed++;
        } else {
            console.log(`   ❌ FAIL`);
            failed++;
            
            if (!repMatch) {
                console.log(`      Répétition: attendu=${testCase.expected.repetition}, obtenu=${repResult.isRepetition}`);
                if (repResult.matches.length > 0) {
                    repResult.matches.forEach(m => console.log(`        - ${m}`));
                }
            }
            if (!truncMatch) {
                console.log(`      Troncature: attendu=${testCase.expected.truncation}, obtenu=${truncResult.isTruncated}`);
                if (truncResult.reason) console.log(`        - ${truncResult.reason}`);
            }
            if (!artMatch) {
                console.log(`      Artifact: attendu=${testCase.expected.artifact}, obtenu=${artResult.hasArtifacts}`);
                if (artResult.type) console.log(`        - ${artResult.type}`);
            }
        }
    }
    
    // Résumé
    console.log('\n' + '📊'.repeat(40));
    console.log(`  RÉSULTATS: ${passed}/${REAL_WORLD_CASES.length} tests passés`);
    console.log(`  Taux de réussite: ${(passed/REAL_WORLD_CASES.length*100).toFixed(0)}%`);
    console.log('📊'.repeat(40) + '\n');
    
    if (failed > 0) {
        console.log(`🔴 ${failed} test(s) ont échoué - Des bugs ne sont pas détectés!`);
        process.exit(1);
    } else {
        console.log(`✅ Tous les tests passent - La détection fonctionne!`);
        process.exit(0);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST DE STRESS: DÉTECTION EN TEMPS RÉEL
// ═══════════════════════════════════════════════════════════════════════════

function stressTestDetectionSpeed() {
    console.log('\n⚡ TEST DE VITESSE (1000 itérations)');
    
    const testCases = REAL_WORLD_CASES.map(c => c.response);
    const iterations = 1000;
    const start = Date.now();
    
    for (let i = 0; i < iterations; i++) {
        for (const response of testCases) {
            detectArtifacts(response);
            detectTruncation(response);
        }
    }
    
    const duration = Date.now() - start;
    console.log(`   ${iterations * testCases.length} détections en ${duration}ms`);
    console.log(`   ${(duration / (iterations * testCases.length)).toFixed(3)}ms par détection`);
    
    if (duration > 1000) {
        console.log(`   ⚠️ Lent - risque de ralentir le swarm`);
    } else {
        console.log(`   ✅ Rapide - pas d'impact sur les performances`);
    }
}

// Run
runTests();
stressTestDetectionSpeed();
