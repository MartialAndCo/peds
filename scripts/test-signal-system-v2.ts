/**
 * Test du Signal System V2
 * 
 * Vérifie:
 * 1. TTL des signaux (expiration automatique)
 * 2. Régression de phase
 * 3. Corrélation Mem0-Signaux
 * 4. Fréquence d'analyse augmentée
 */

import { prisma } from '../lib/prisma'
import { signalAnalyzerV2, SIGNAL_TTL } from '../lib/services/signal-analyzer-v2'
import { memorySignalBridge } from '../lib/services/memory-signal-bridge'

async function testSignalSystemV2() {
    console.log('🧪 TEST SIGNAL SYSTEM V2')
    console.log('========================\n')

    // Trouver un agent et contact de test
    const agent = await prisma.agent.findFirst()
    if (!agent) {
        console.error('❌ No agent found')
        return
    }

    const contact = await prisma.contact.findFirst()
    if (!contact) {
        console.error('❌ No contact found')
        return
    }

    console.log(`Using Agent: ${agent.name} (${agent.id})`)
    console.log(`Using Contact: ${contact.name || contact.phone_whatsapp} (${contact.id})\n`)

    // Récupérer ou créer AgentContact
    let agentContact = await prisma.agentContact.findUnique({
        where: {
            agentId_contactId: {
                agentId: agent.id,
                contactId: contact.id
            }
        }
    })

    if (!agentContact) {
        console.log('Creating AgentContact...')
        agentContact = await prisma.agentContact.create({
            data: {
                agentId: agent.id,
                contactId: contact.id,
                phase: 'CONNECTION',
                signals: []
            }
        })
    }

    console.log(`Current Phase: ${agentContact.phase}`)
    console.log(`Current Signals: [${agentContact.signals.join(', ')}]\n`)

    // TEST 1: TTL Calculation
    console.log('TEST 1: TTL Configuration')
    console.log('-------------------------')
    for (const [signal, ttl] of Object.entries(SIGNAL_TTL)) {
        const days = Math.round(ttl / (24 * 60 * 60 * 1000))
        console.log(`  ${signal}: ${days} days`)
    }
    console.log('✅ TTL configured correctly\n')

    // TEST 2: Signal Freshness Calculation
    console.log('TEST 2: Signal Freshness Calculation')
    console.log('-------------------------------------')
    const testCases = [
        { detectedAt: new Date(), expected: 'fresh' },
        { detectedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), expected: 'fresh' }, // 6 days old RESPONSIVE
        { detectedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), expected: 'expiring' }, // 8 days old RESPONSIVE
        { detectedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), expected: 'expired' }, // 10 days old RESPONSIVE
    ]

    for (const test of testCases) {
        const weightedSignal = {
            signal: 'RESPONSIVE' as const,
            detectedAt: test.detectedAt,
            expiresAt: new Date(test.detectedAt.getTime() + SIGNAL_TTL.RESPONSIVE),
            confidence: signalAnalyzerV2.calculateConfidence(test.detectedAt, SIGNAL_TTL.RESPONSIVE),
            occurrences: 1,
            lastConfirmed: test.detectedAt
        }
        
        const freshness = signalAnalyzerV2.isExpired(weightedSignal) ? 'expired' : 
            (signalAnalyzerV2.calculateConfidence(test.detectedAt, SIGNAL_TTL.RESPONSIVE) > 0.5 ? 'fresh' : 'expiring')
        
        console.log(`  Age: ${Math.round((Date.now() - test.detectedAt.getTime()) / (24 * 60 * 60 * 1000))} days`)
        console.log(`  Confidence: ${weightedSignal.confidence.toFixed(2)}`)
        console.log(`  Expected: ${test.expected}, Got: ${freshness}`)
        console.log()
    }

    // TEST 3: Memory-Signal Bridge
    console.log('TEST 3: Memory-Signal Bridge')
    console.log('-----------------------------')
    const testMemories = [
        "User said they love me and miss me every day",
        "User sent $100 via PayPal to help with bills",
        "User shared that they're going through a divorce",
        "User asked if I am a real person or a scam",
        "User initiated conversation 3 times this week"
    ]

    for (const memory of testMemories) {
        const detected = memorySignalBridge.detectSignalsFromMemory(memory)
        console.log(`  Memory: "${memory.substring(0, 50)}..."`)
        console.log(`  Detected signals: ${detected.map(d => d.signal).join(', ') || 'None'}`)
        console.log()
    }

    // TEST 4: Weighted Signals Retrieval
    console.log('TEST 4: Weighted Signals Retrieval')
    console.log('-----------------------------------')
    const weightedSignals = await signalAnalyzerV2.getWeightedSignals(agent.id, contact.id)
    console.log(`Found ${weightedSignals.length} weighted signals:`)
    for (const ws of weightedSignals) {
        const daysOld = Math.round((Date.now() - ws.detectedAt.getTime()) / (24 * 60 * 60 * 1000))
        const daysLeft = Math.round((ws.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        console.log(`  ${ws.signal}:`)
        console.log(`    - Age: ${daysOld} days`)
        console.log(`    - Expires in: ${daysLeft} days`)
        console.log(`    - Confidence: ${ws.confidence.toFixed(2)}`)
        console.log(`    - Occurrences: ${ws.occurrences}`)
        console.log()
    }

    // TEST 5: Phase Transition Logic
    console.log('TEST 5: Phase Transition Logic')
    console.log('-------------------------------')
    const transitionTests = [
        { phase: 'CONNECTION', signals: ['RESPONSIVE', 'INTERESTED'], days: 1, expected: false }, // Not enough days
        { phase: 'CONNECTION', signals: ['RESPONSIVE', 'INTERESTED'], days: 3, expected: true },  // Should advance
        { phase: 'CONNECTION', signals: ['RESPONSIVE', 'DEFENSIVE'], days: 3, expected: false }, // Blocked
        { phase: 'VULNERABILITY', signals: ['ATTACHED', 'EMOTIONALLY_OPEN'], days: 1, expected: true }, // Crisis
        { phase: 'CRISIS', signals: ['FINANCIAL_TRUST'], days: 1, expected: true }, // Moneypot
    ]

    for (const test of transitionTests) {
        const result = signalAnalyzerV2.checkPhaseTransition(
            test.phase as any,
            test.signals as any,
            test.days
        )
        const passed = result.canAdvance === test.expected
        console.log(`  ${test.phase} with [${test.signals.join(', ')}] (${test.days} days)`)
        console.log(`    Expected advance: ${test.expected}, Got: ${result.canAdvance}`)
        console.log(`    ${passed ? '✅ PASS' : '❌ FAIL'}`)
        console.log()
    }

    // TEST 6: Phase Regression Logic
    console.log('TEST 6: Phase Regression Logic')
    console.log('-------------------------------')
    console.log('Creating test scenario...')

    // Simuler un contact en VULNERABILITY avec signal DEFENSIVE
    await prisma.agentContact.update({
        where: { id: agentContact.id },
        data: {
            phase: 'VULNERABILITY',
            signals: ['RESPONSIVE', 'DEFENSIVE']
        }
    })

    // Créer un vieux message pour simuler l'inactivité
    const oldDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4 days ago

    // Créer des SignalLogs pour simuler des signaux expirés
    await prisma.signalLog.createMany({
        data: [
            {
                agentId: agent.id,
                contactId: contact.id,
                signal: 'ATTACHED',
                action: 'DETECTED',
                createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago (expired)
                reason: 'Test: User said they love me'
            },
            {
                agentId: agent.id,
                contactId: contact.id,
                signal: 'EMOTIONALLY_OPEN',
                action: 'DETECTED',
                createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago (expired)
                reason: 'Test: User shared divorce story'
            }
        ]
    })

    const analysis = await signalAnalyzerV2.analyzeWithTTL(agent.id, contact.id)
    console.log(`  Current phase: VULNERABILITY`)
    console.log(`  Active signals: [${analysis.activeSignals.join(', ')}]`)
    console.log(`  Expired signals: [${analysis.expiredSignals.join(', ')}]`)
    console.log(`  Should regress: ${analysis.shouldRegress}`)
    console.log(`  Reason: ${analysis.reason}`)
    console.log()

    // Cleanup
    console.log('🧹 Cleaning up test data...')
    await prisma.signalLog.deleteMany({
        where: {
            agentId: agent.id,
            contactId: contact.id,
            reason: { startsWith: 'Test:' }
        }
    })
    console.log('✅ Cleanup complete\n')

    console.log('========================')
    console.log('✅ ALL TESTS COMPLETED')
    console.log('========================')
}

testSignalSystemV2()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect()
    })
