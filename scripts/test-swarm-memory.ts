/**
 * Test du SWARM avec mémoire
 * Vérifie que les mémoires sont chargées et utilisées
 */

import { runSwarm } from '@/lib/swarm'
import { memoryService } from '@/lib/memory'
import { prisma } from '@/lib/prisma'

async function testSwarmMemory() {
    console.log('═'.repeat(70))
    console.log('🧪 TEST SWARM + MÉMOIRE')
    console.log('═'.repeat(70))

    const agent = await prisma.agent.findFirst({
        where: { name: { contains: 'Anaïs' } }
    })
    
    if (!agent) {
        console.log('❌ Agent non trouvé')
        return
    }

    const contact = await prisma.contact.findFirst({
        where: { phone_whatsapp: { startsWith: '+33' } }
    })

    if (!contact) {
        console.log('❌ Contact non trouvé')
        return
    }

    console.log(`\n📋 Agent: ${agent.name}`)
    console.log(`📋 Contact: ${contact.phone_whatsapp}`)

    // 1. Ajouter des mémoires de test
    console.log('\n📝 Étape 1: Ajout de mémoires de test...')
    const userId = memoryService.buildUserId(contact.phone_whatsapp, agent.id as string)
    
    await memoryService.addMany(userId, [
        'User s\'appelle Marc',
        'User a 25 ans',
        'User habite à Lyon',
        'User adore le foot et supporte l\'OL'
    ])
    
    // Vérifier les mémoires
    const memories = await memoryService.getAll(userId)
    console.log(`✅ ${memories.length} mémoires ajoutées`)

    // 2. Test avec question personnelle (doit déclencher besoinMemoire)
    console.log('\n📝 Étape 2: Test avec question sur le prénom...')
    
    const response1 = await runSwarm(
        'Tu te souviens de mon prénom ?',
        [],
        contact.id,
        agent.id,
        contact.name || 'Marc',
        'text'
    )
    
    console.log(`💬 Réponse: "${response1}"`)
    
    if (response1.toLowerCase().includes('marc')) {
        console.log('✅ SUCCÈS: Elle a utilisé la mémoire (Marc)')
    } else {
        console.log('❌ ÉCHEC: Elle n\'a pas mentionné Marc')
    }

    // 3. Test avec question sur l'âge
    console.log('\n📝 Étape 3: Test avec question sur l\'âge...')
    
    const response2 = await runSwarm(
        'T\'as dit que j\'avais quel âge déjà ?',
        [],
        contact.id,
        agent.id,
        contact.name || 'Marc',
        'text'
    )
    
    console.log(`💬 Réponse: "${response2}"`)
    
    if (response2.includes('25')) {
        console.log('✅ SUCCÈS: Elle a utilisé la mémoire (25 ans)')
    } else {
        console.log('❌ ÉCHEC: Elle n\'a pas mentionné 25 ans')
    }

    // 4. Test avec question sur la ville
    console.log('\n📝 Étape 4: Test avec question sur la ville...')
    
    const response3 = await runSwarm(
        'Je viens d\'où moi ?',
        [],
        contact.id,
        agent.id,
        contact.name || 'Marc',
        'text'
    )
    
    console.log(`💬 Réponse: "${response3}"`)
    
    if (response3.toLowerCase().includes('lyon')) {
        console.log('✅ SUCCÈS: Elle a utilisé la mémoire (Lyon)')
    } else {
        console.log('❌ ÉCHEC: Elle n\'a pas mentionné Lyon')
    }

    // 5. Test avec question qui ne nécessite pas de mémoire
    console.log('\n📝 Étape 5: Test sans besoin de mémoire (général)...')
    
    const response4 = await runSwarm(
        'Ça va ?',
        [],
        contact.id,
        agent.id,
        contact.name || 'Marc',
        'text'
    )
    
    console.log(`💬 Réponse: "${response4}"`)
    console.log('✅ Réponse générale (pas besoin de mémoire)')

    console.log('\n' + '═'.repeat(70))
    console.log('🏁 Test mémoire terminé')
    console.log('═'.repeat(70))
}

testSwarmMemory()
    .then(() => process.exit(0))
    .catch(e => {
        console.error('Test failed:', e)
        process.exit(1)
    })
