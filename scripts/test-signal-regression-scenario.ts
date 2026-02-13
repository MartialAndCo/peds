/**
 * Test de scénario complet: Régression de phase
 * 
 * Simule:
 * 1. Contact qui progresse VULNERABILITY → CRISIS
 * 2. Puis devient DEFENSIF et INACTIF
 * 3. Vérifie la régression CRISIS → VULNERABILITY
 */

import { prisma } from '../lib/prisma'
import { signalAnalyzerV2, SIGNAL_TTL } from '../lib/services/signal-analyzer-v2'

async function testRegressionScenario() {
    console.log('🎭 TEST SCÉNARIO: Régression de Phase')
    console.log('=====================================\n')

    // Utiliser un agent existant
    const agent = await prisma.agent.findFirst()
    if (!agent) {
        console.error('❌ Aucun agent trouvé dans la base de données')
        return
    }

    // Créer un contact de test avec numéro unique
    const uniquePhone = `+33999${Date.now().toString().slice(-8)}`
    const contact = await prisma.contact.create({
        data: {
            name: 'Test Regression Contact',
            phone_whatsapp: uniquePhone
        }
    })

    // Créer AgentContact en CRISIS (simuler qu'il a déjà progressé)
    const agentContact = await prisma.agentContact.create({
        data: {
            agentId: agent.id,
            contactId: contact.id,
            phase: 'CRISIS',
            signals: ['RESPONSIVE', 'DEFENSIVE'] // DEFENSIVE actif!
        }
    })

    console.log('📋 Setup:')
    console.log(`  Agent: ${agent.name}`)
    console.log(`  Contact: ${contact.name}`)
    console.log(`  Phase initiale: CRISIS`)
    console.log(`  Signaux: [RESPONSIVE, DEFENSIVE]`)
    console.log()

    // Créer un ancien SignalLog pour ATTACHED (expiré - 15 jours)
    await prisma.signalLog.create({
        data: {
            agentId: agent.id,
            contactId: contact.id,
            signal: 'ATTACHED',
            action: 'DETECTED',
            reason: 'Test: Old attachment signal',
            createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
        }
    })

    // Créer un SignalLog récent pour DEFENSIVE
    await prisma.signalLog.create({
        data: {
            agentId: agent.id,
            contactId: contact.id,
            signal: 'DEFENSIVE',
            action: 'DETECTED',
            reason: 'Test: User became suspicious',
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 heure
        }
    })

    // ÉTAPE 1: Vérifier l'état actuel
    console.log('📊 ÉTAPE 1: Vérification état initial')
    
    const weightedSignals = await signalAnalyzerV2.getWeightedSignals(agent.id, contact.id)
    const activeSignals = weightedSignals.filter(s => !signalAnalyzerV2.isExpired(s)).map(s => s.signal)
    const expiredSignals = weightedSignals.filter(s => signalAnalyzerV2.isExpired(s)).map(s => s.signal)
    
    console.log(`  Signaux actifs: [${activeSignals.join(', ')}]`)
    console.log(`  Signaux expirés: [${expiredSignals.join(', ')}]`)
    console.log(`  ATTACHED expiré: ${expiredSignals.includes('ATTACHED') ? '✅ OUI' : '❌ Non'}`)
    console.log()

    // ÉTAPE 2: Test transition simple
    console.log('⬆️ ÉTAPE 2: Test progression CRISIS → MONEYPOT (sans FINANCIAL_TRUST)')
    const step2 = signalAnalyzerV2.checkPhaseTransition(
        'CRISIS',
        activeSignals,
        5
    )
    console.log(`  Résultat: ${step2.canAdvance ? '✅ PEUT AVANCER' : '❌ Bloqué'}`)
    if (!step2.canAdvance) {
        console.log(`  Raison: ${step2.reason}`)
    }
    console.log()

    // ÉTAPE 3: Test régression sans inactivité
    console.log('⏸️ ÉTAPE 3: Test régression (sans vérifier inactivité)')
    
    // Simuler les conditions de régression manuellement
    const hasDefensive = activeSignals.includes('DEFENSIVE')
    const hasAttachedExpired = expiredSignals.includes('ATTACHED')
    
    console.log(`  DEFENSIVE actif: ${hasDefensive ? '✅ OUI' : '❌ Non'}`)
    console.log(`  ATTACHED expiré: ${hasAttachedExpired ? '✅ OUI' : '❌ Non'}`)
    
    if (hasDefensive && hasAttachedExpired) {
        console.log(`  ⬇️ CONDITIONS RÉGRESSION RÉUNIES!`)
        console.log(`     CRISIS → VULNERABILITY`)
    } else {
        console.log(`  ⏸️ Conditions non remplies pour régression`)
    }
    console.log()

    // ÉTAPE 4: Test calcul confiance TTL
    console.log('📊 ÉTAPE 4: Test calcul confiance TTL')
    
    for (const signal of weightedSignals) {
        const daysOld = (Date.now() - signal.detectedAt.getTime()) / (24 * 60 * 60 * 1000)
        const ttlDays = SIGNAL_TTL[signal.signal] / (24 * 60 * 60 * 1000)
        const remainingDays = (signal.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        
        console.log(`  ${signal.signal}:`)
        console.log(`    - Âge: ${daysOld.toFixed(1)} jours / TTL: ${ttlDays} jours`)
        console.log(`    - Confiance: ${signal.confidence.toFixed(2)}`)
        console.log(`    - Expire dans: ${remainingDays.toFixed(1)} jours`)
        console.log(`    - Expiré: ${signalAnalyzerV2.isExpired(signal) ? '✅ OUI' : '❌ Non'}`)
        console.log()
    }

    // ÉTAPE 5: Test updateSignals complet
    console.log('🔄 ÉTAPE 5: Test updateSignals complet')
    
    const result = await signalAnalyzerV2.updateSignals(agent.id, contact.id)
    
    console.log(`  Nouveaux signaux détectés: [${result.newSignals.join(', ')}]`)
    console.log(`  Signaux perdus: [${result.lostSignals.join(', ')}]`)
    console.log(`  Signaux actuels: [${result.currentSignals.join(', ')}]`)
    console.log(`  Signaux expirés: [${result.expiredSignals.join(', ')}]`)
    console.log(`  Régression déclenchée: ${result.shouldRegressPhase ? '✅ OUI' : '❌ Non'}`)
    if (result.newPhase) {
        console.log(`  Changement de phase: ${result.previousPhase} → ${result.newPhase}`)
    }
    console.log()

    // Cleanup
    console.log('🧹 Nettoyage...')
    await prisma.signalLog.deleteMany({ 
        where: { 
            agentId: agent.id, 
            contactId: contact.id
        } 
    })
    await prisma.agentContact.delete({
        where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } }
    })
    await prisma.contact.delete({ where: { id: contact.id } })
    
    console.log('✅ Test scénario terminé avec succès!')
}

testRegressionScenario()
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
