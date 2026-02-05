/**
 * Test ciblé: Validation ne doit plus inventer
 * Vérifie que quand on corrige, on garde les mémoires
 */

import { runSwarm } from '@/lib/swarm'
import { memoryService } from '@/lib/memory'
import { prisma } from '@/lib/prisma'

async function testValidationFix() {
    console.log('═'.repeat(70))
    console.log('🎯 TEST: Validation garde les mémoires (pas d\'invention)')
    console.log('═'.repeat(70))

    const agent = await prisma.agent.findFirst({ where: { name: { contains: 'Anaïs' } } })
    const contact = await prisma.contact.findFirst({ where: { phone_whatsapp: { startsWith: '+33' } } })
    
    if (!agent || !contact) {
        console.log('❌ Agent ou contact non trouvé')
        return
    }

    // Setup: Ajouter mémoire "Marc"
    const userId = memoryService.buildUserId(contact.phone_whatsapp, agent.id as string)
    await memoryService.add(userId, 'User s\'appelle Marc')
    await memoryService.add(userId, 'User a 25 ans')
    console.log('✅ Mémoires ajoutées: Marc, 25 ans')

    // Test 1: Question qui doit utiliser la mémoire
    console.log('\n📝 Test 1: "Tu te souviens de mon prénom ?"')
    console.log('   Attendu: Doit dire "Marc" (pas inventer un autre prénom)')
    
    const response1 = await runSwarm(
        'Tu te souviens de mon prénom ?',
        [],
        contact.id,
        agent.id,
        'Marc',
        'text'
    )
    
    console.log(`   Réponse: "${response1}"`)
    
    if (response1.toLowerCase().includes('marc')) {
        console.log('   ✅ PASS: A bien dit "Marc"')
    } else if (response1.toLowerCase().includes('lucas') || 
               response1.toLowerCase().includes('tom') || 
               response1.toLowerCase().includes('jean') ||
               response1.toLowerCase().includes('pierre')) {
        console.log('   ❌ FAIL: A INVENTÉ un prénom !')
    } else {
        console.log('   ⚠️ NEUTRE: N\'a pas mentionné de prénom')
    }

    // Test 2: Question sur l'âge
    console.log('\n📝 Test 2: "T\'as dit j\'avais quel âge ?"')
    console.log('   Attendu: Doit dire "25" (pas inventer un autre âge)')
    
    const response2 = await runSwarm(
        "T'as dit j'avais quel âge ?",
        [],
        contact.id,
        agent.id,
        'Marc',
        'text'
    )
    
    console.log(`   Réponse: "${response2}"`)
    
    if (response2.includes('25')) {
        console.log('   ✅ PASS: A bien dit "25"')
    } else if (response2.includes('18') || response2.includes('20') || response2.includes('30')) {
        console.log('   ❌ FAIL: A INVENTÉ un autre âge !')
    } else {
        console.log('   ⚠️ NEUTRE: N\'a pas mentionné l\'âge')
    }

    // Test 3: Style - Vérifier qu'on n'a pas de pavés
    console.log('\n📝 Test 3: Style court (pas de paragraphe)')
    console.log('   Max attendu: ~50 caractères')
    
    const longResponses: string[] = []
    const testMessages = ['Ça va ?', 'Tu fais quoi ?', 'Tu viens d\'où ?']
    
    for (const msg of testMessages) {
        const resp = await runSwarm(msg, [], contact.id, agent.id, 'Marc', 'text')
        console.log(`   "${msg}" → "${resp.substring(0, 40)}${resp.length > 40 ? '...' : ''}" (${resp.length} chars)`)
        if (resp.length > 80) {
            longResponses.push(`"${msg}" → ${resp.length} chars`)
        }
    }
    
    if (longResponses.length === 0) {
        console.log('   ✅ PASS: Toutes les réponses sont courtes')
    } else {
        console.log(`   ❌ FAIL: ${longResponses.length} réponse(s) trop longue(s):`)
        longResponses.forEach(r => console.log(`      - ${r}`))
    }

    // Nettoyage
    await memoryService.deleteAll(userId)
    
    console.log('\n' + '═'.repeat(70))
    console.log('🏁 Test terminé')
    console.log('═'.repeat(70))
}

testValidationFix()
    .then(() => process.exit(0))
    .catch(e => {
        console.error('Test failed:', e)
        process.exit(1)
    })
