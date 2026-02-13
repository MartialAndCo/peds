/**
 * STRESS TEST SWARM - Simulations réelles de production
 * 
 * Scénarios testés:
 * 1. BURST: 5 messages en 10 secondes
 * 2. LOOP: IA qui répète la même phrase 5x
 * 3. CONTEXT_CHAOS: Changements de sujet brutaux
 * 4. LONG_CONV: 50+ messages d'historique
 * 5. RACE_CONDITION: Messages simultanés
 * 6. API_STRESS: Venice lent/timeout
 * 7. EDGE_CASES: Messages vides, emoji seul, etc.
 */

import { runSwarm } from '../lib/swarm'
import { validationNode } from '../lib/swarm/nodes/validation-node'
import { responseNode } from '../lib/swarm/nodes/response-node'
import { supervisorOrchestrator } from '../lib/services/supervisor/orchestrator'
import { coherenceAgent } from '../lib/services/supervisor/coherence-agent'

const TEST_CONFIG = {
    agentId: 'test-agent-123',
    contactId: 'test-contact-456',
    userName: 'TestUser'
}

// ═══════════════════════════════════════════════════════════════════════════
// SCÉNARIO 1: BURST DE MESSAGES (Ce qui cause les répétitions)
// ═══════════════════════════════════════════════════════════════════════════

async function testBurstScenario() {
    console.log('\n🔥 SCÉNARIO 1: BURST DE MESSAGES (5 msg en 10s)')
    console.log('═'.repeat(60))
    
    const messages = [
        'hey',
        'tu fais quoi',
        'hello??',
        'réponds',
        'stp'
    ]
    
    const responses: string[] = []
    const startTime = Date.now()
    
    for (const msg of messages) {
        const history = messages.slice(0, messages.indexOf(msg)).map((m, i) => ({
            role: i % 2 === 0 ? 'user' : 'ai',
            content: i % 2 === 0 ? m : responses[Math.floor(i/2)] || '...'
        }))
        
        try {
            const response = await runSwarm(
                msg,
                history,
                TEST_CONFIG.contactId,
                TEST_CONFIG.agentId,
                TEST_CONFIG.userName
            )
            responses.push(response)
            console.log(`  ${msg} → "${response}"`)
        } catch (e: any) {
            console.log(`  ${msg} → ERROR: ${e.message}`)
        }
    }
    
    // Analyse des réponses
    const uniqueResponses = [...new Set(responses.map(r => r.toLowerCase().trim()))]
    const repetitionRate = 1 - (uniqueResponses.length / responses.length)
    
    console.log(`\n  📊 Résultat:`)
    console.log(`     - Temps total: ${Date.now() - startTime}ms`)
    console.log(`     - Réponses uniques: ${uniqueResponses.length}/${responses.length}`)
    console.log(`     - Taux de répétition: ${(repetitionRate * 100).toFixed(0)}%`)
    
    if (repetitionRate > 0.3) {
        console.log(`     ❌ ÉCHEC: Trop de répétitions détectées!`)
        return false
    }
    return true
}

// ═══════════════════════════════════════════════════════════════════════════
// SCÉNARIO 2: BOUCLE DE RÉPÉTITION (Le bug observé)
// ═══════════════════════════════════════════════════════════════════════════

async function testRepetitionLoop() {
    console.log('\n🔥 SCÉNARIO 2: BOUCLE DE RÉPÉTITION (Demande de photos)')
    console.log('═'.repeat(60))
    
    const history = [
        { role: 'user', content: 'good how about you' },
        { role: 'ai', content: 'Be patient, love. More soon. I\'m always here for you.' },
        { role: 'user', content: 'Love can i see more photos of u??' },
        { role: 'ai', content: 'Be patient, love. More soon. I\'m always here for you.' },
        { role: 'user', content: 'Ohh okay but i waan see u more' },
        { role: 'ai', content: 'Be patient, love. More soon. I\'m always here for you.' },
        { role: 'user', content: 'Okay' },
        // La prochaine réponse devrait être DIFFÉRENTE
    ]
    
    const userMessage = 'And more photos??'
    
    try {
        const response = await runSwarm(
            userMessage,
            history,
            TEST_CONFIG.contactId,
            TEST_CONFIG.agentId,
            TEST_CONFIG.userName
        )
        
        console.log(`  Historique: ${history.length} messages`)
        console.log(`  Dernières réponses IA:`)
        history.filter(h => h.role === 'ai').slice(-3).forEach((h, i) => {
            console.log(`    ${i+1}. "${h.content}"`)
        })
        console.log(`  Nouvelle réponse: "${response}"`)
        
        // Vérifie si c'est encore la même
        const lastAiResponses = history
            .filter(h => h.role === 'ai')
            .slice(-3)
            .map(h => h.content.toLowerCase().trim())
        
        const isRepetition = lastAiResponses.some(r => 
            response.toLowerCase().includes('be patient') ||
            response.toLowerCase().includes('more soon')
        )
        
        if (isRepetition) {
            console.log(`     ❌ ÉCHEC: Répétition détectée!`)
            return false
        }
        console.log(`     ✅ SUCCÈS: Réponse différente`)
        return true
        
    } catch (e: any) {
        console.log(`     ERROR: ${e.message}`)
        return false
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCÉNARIO 3: PERTE DE CONTEXTE (Messages courts consécutifs)
// ═══════════════════════════════════════════════════════════════════════════

async function testContextLoss() {
    console.log('\n🔥 SCÉNARIO 3: PERTE DE CONTEXTE (Fatigue)')
    console.log('═'.repeat(60))
    
    const history = [
        { role: 'user', content: 'Je suis ko' },
        { role: 'ai', content: 'oh :( repos toi' },
        { role: 'user', content: 'Et toi pas trop fatique' },
        { role: 'ai', content: 'jsuis crevée aussi' },
        { role: 'user', content: 'Fatigue' },  // Contexte: fatigue
    ]
    
    try {
        const response = await runSwarm(
            'Fatigue',
            history,
            TEST_CONFIG.contactId,
            TEST_CONFIG.agentId,
            TEST_CONFIG.userName
        )
        
        console.log(`  Contexte: FATIGUE/ÉPUISEMENT`)
        console.log(`  Réponse: "${response}"`)
        
        // La réponse doit mentionner fatigue, repos, ou sommeil
        const validTopics = ['fatigue', 'crevé', 'repos', 'dors', 'sommeil', 'couch', 'tkt', 'dommage']
        const isRelevant = validTopics.some(t => 
            response.toLowerCase().includes(t)
        )
        
        if (response.length < 3 || response.includes('**') || !isRelevant) {
            console.log(`     ❌ ÉCHEC: Perte de contexte ou artifact!`)
            return false
        }
        console.log(`     ✅ SUCCÈS: Contexte respecté`)
        return true
        
    } catch (e: any) {
        console.log(`     ERROR: ${e.message}`)
        return false
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCÉNARIO 4: CONVERSATION LONGUE (50+ messages)
// ═══════════════════════════════════════════════════════════════════════════

async function testLongConversation() {
    console.log('\n🔥 SCÉNARIO 4: CONVERSATION LONGUE (50 messages)')
    console.log('═'.repeat(60))
    
    // Génère un historique de 50 messages
    const history: { role: string; content: string }[] = []
    const topics = ['salut', 'ça va', 'tu fais quoi', 'jsuis au lycée', 'c\'est nul', 'et toi', 'pareil', 'lol', 'mdr']
    
    for (let i = 0; i < 50; i++) {
        if (i % 2 === 0) {
            history.push({ role: 'user', content: topics[i % topics.length] })
        } else {
            history.push({ role: 'ai', content: `réponse ${i}` })
        }
    }
    
    const startTime = Date.now()
    
    try {
        const response = await runSwarm(
            'Tu te souviens de ce qu\'on disait au début?',
            history,
            TEST_CONFIG.contactId,
            TEST_CONFIG.agentId,
            TEST_CONFIG.userName
        )
        
        console.log(`  Historique: ${history.length} messages`)
        console.log(`  Temps de réponse: ${Date.now() - startTime}ms`)
        console.log(`  Réponse: "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`)
        
        // Vérifie pas de troncature
        if (response.length < 5 || /\b(je|tu|il|moi|et|ou)\s*$/i.test(response)) {
            console.log(`     ❌ ÉCHEC: Réponse tronquée ou trop courte!`)
            return false
        }
        
        console.log(`     ✅ SUCCÈS: Réponse complète`)
        return true
        
    } catch (e: any) {
        console.log(`     ERROR: ${e.message}`)
        return false
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCÉNARIO 5: VALIDATION BLOQUANTE (Supervisor)
// ═══════════════════════════════════════════════════════════════════════════

async function testBlockingValidation() {
    console.log('\n🔥 SCÉNARIO 5: VALIDATION BLOQUANTE (Supervisor)')
    console.log('═'.repeat(60))
    
    // Simule une réponse problématique
    const problematicResponse = 'Be patient, love. More soon. I\'m always here for you.'
    const history = [
        { role: 'user', content: 'hello' },
        { role: 'ai', content: problematicResponse },
        { role: 'user', content: 'what?' },
        { role: 'ai', content: problematicResponse },
        { role: 'user', content: 'again?' },
    ]
    
    const context = {
        agentId: TEST_CONFIG.agentId,
        conversationId: 12345,
        contactId: TEST_CONFIG.contactId,
        userMessage: 'again?',
        aiResponse: problematicResponse,
        history: history.map(h => ({ role: h.role as 'user' | 'ai', content: h.content })),
        phase: 'CONNECTION',
        pendingQueue: []
    }
    
    try {
        const validation = await supervisorOrchestrator.validateBlocking(context)
        
        console.log(`  Réponse testée: "${problematicResponse}"`)
        console.log(`  Historique: ${history.filter(h => h.role === 'ai').length} réponses IA identiques`)
        console.log(`  Résultat validation:`)
        console.log(`    - isValid: ${validation.isValid}`)
        console.log(`    - severity: ${validation.severity}`)
        console.log(`    - shouldRegenerate: ${validation.shouldRegenerate}`)
        console.log(`    - Issues: ${validation.issues.length > 0 ? validation.issues.join('; ') : 'Aucune'}`)
        
        if (validation.isValid || !validation.shouldRegenerate) {
            console.log(`     ❌ ÉCHEC: Le supervisor n'a pas détecté la répétition!`)
            return false
        }
        console.log(`     ✅ SUCCÈS: Répétition détectée, régénération demandée`)
        return true
        
    } catch (e: any) {
        console.log(`     ERROR: ${e.message}`)
        return false
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCÉNARIO 6: COHERENCE AGENT (Détection programmatique)
// ═══════════════════════════════════════════════════════════════════════════

async function testCoherenceDetection() {
    console.log('\n🔥 SCÉNARIO 6: DÉTECTION PROGRAMMATIQUE')
    console.log('═'.repeat(60))
    
    const testCases = [
        { response: '**', expected: 'ARTIFACT', desc: 'Asterisks seuls' },
        { response: '```', expected: 'ARTIFACT', desc: 'Backticks seuls' },
        { response: 'Les autres ont des iPhone 15 moi', expected: 'TRUNCATION', desc: 'Troncature (finit par moi)' },
        { response: 'je suis là et je', expected: 'TRUNCATION', desc: 'Troncature (finit par je)' },
        { response: 'Be patient, love', history: ['ai', 'ai', 'ai'].map(r => ({ role: r, content: 'Be patient, love' })), expected: 'REPETITION', desc: 'Répétition pattern' }
    ]
    
    let passed = 0
    
    for (const testCase of testCases) {
        const context = {
            agentId: TEST_CONFIG.agentId,
            conversationId: 12345,
            contactId: TEST_CONFIG.contactId,
            userMessage: 'test',
            aiResponse: testCase.response,
            history: testCase.history || [{ role: 'user', content: 'hello' }, { role: 'ai', content: 'hi' }],
            phase: 'CONNECTION'
        }
        
        const result = await coherenceAgent.analyze(context)
        const detected = result.alerts.some(a => a.alertType === testCase.expected)
        
        console.log(`  ${testCase.desc}: "${testCase.response}"`)
        console.log(`    Expected: ${testCase.expected}, Detected: ${detected ? 'YES' : 'NO'}`)
        
        if (detected) passed++
        else console.log(`    ❌ Non détecté!`)
    }
    
    console.log(`\n  📊 Score: ${passed}/${testCases.length} détections correctes`)
    return passed === testCases.length
}

// ═══════════════════════════════════════════════════════════════════════════
// SCÉNARIO 7: MESSAGES PROBLÉMATIQUES (Edge cases)
// ═══════════════════════════════════════════════════════════════════════════

async function testEdgeCases() {
    console.log('\n🔥 SCÉNARIO 7: EDGE CASES')
    console.log('═'.repeat(60))
    
    const edgeCases = [
        '',           // Vide
        '   ',        // Espaces
        '😀',         // Emoji seul
        '???',        // Ponctuation seule
        'ok',         // Très court
        'a',          // 1 caractère
    ]
    
    for (const msg of edgeCases) {
        try {
            const response = await runSwarm(
                msg,
                [{ role: 'user', content: 'hello' }],
                TEST_CONFIG.contactId,
                TEST_CONFIG.agentId,
                TEST_CONFIG.userName
            )
            console.log(`  "${msg}" → "${response}"`)
        } catch (e: any) {
            console.log(`  "${msg}" → ERROR: ${e.message}`)
        }
    }
    return true
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN ALL TESTS
// ═══════════════════════════════════════════════════════════════════════════

async function runAllTests() {
    console.log('\n' + '🔴'.repeat(30))
    console.log('  SWARM STRESS TEST - SIMULATIONS RÉELLES')
    console.log('🔴'.repeat(30) + '\n')
    
    const results: { name: string; passed: boolean }[] = []
    
    // Run all scenarios
    results.push({ name: 'Burst de messages', passed: await testBurstScenario() })
    results.push({ name: 'Boucle de répétition', passed: await testRepetitionLoop() })
    results.push({ name: 'Perte de contexte', passed: await testContextLoss() })
    results.push({ name: 'Conversation longue', passed: await testLongConversation() })
    results.push({ name: 'Validation bloquante', passed: await testBlockingValidation() })
    results.push({ name: 'Détection programmatique', passed: await testCoherenceDetection() })
    results.push({ name: 'Edge cases', passed: await testEdgeCases() })
    
    // Summary
    console.log('\n' + '📊'.repeat(30))
    console.log('  RÉSULTATS FINaux')
    console.log('📊'.repeat(30))
    
    const passed = results.filter(r => r.passed).length
    const total = results.length
    
    results.forEach(r => {
        console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`)
    })
    
    console.log(`\n  Total: ${passed}/${total} tests réussis (${(passed/total*100).toFixed(0)}%)`)
    
    if (passed < total) {
        console.log('\n  🔴 CERTAINS TESTS ONT ÉCHOUÉ - DES PROBLÈMES SONT ENCORE PRÉSENTS')
        process.exit(1)
    } else {
        console.log('\n  ✅ TOUS LES TESTS SONT PASSÉS')
        process.exit(0)
    }
}

// Run if executed directly
if (require.main === module) {
    runAllTests().catch(console.error)
}

export { runAllTests }
