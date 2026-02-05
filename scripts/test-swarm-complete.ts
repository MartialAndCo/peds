/**
 * Test du SWARM complet avec tous les agents
 * Vérifie que la chaîne de commandement fonctionne
 */

import { runSwarm } from '@/lib/swarm'

async function testSwarm() {
    console.log('═'.repeat(70))
    console.log('🧪 TEST SWARM COMPLET')
    console.log('═'.repeat(70))

    // Récupérer un agent et un contact de test
    const { prisma } = await import('@/lib/prisma')
    
    const agent = await prisma.agent.findFirst({
        where: { name: { contains: 'Anaïs' } }
    })
    
    if (!agent) {
        console.log('❌ Agent Anaïs non trouvé')
        return
    }

    const contact = await prisma.contact.findFirst({
        where: { phone_whatsapp: { startsWith: '+33' } }
    })

    if (!contact) {
        console.log('❌ Contact non trouvé')
        return
    }

    console.log(`\n📋 Agent: ${agent.name} (${agent.id})`)
    console.log(`📋 Contact: ${contact.phone_whatsapp}`)

    const testCases = [
        {
            name: 'Message simple',
            message: 'Ça va ?',
            history: []
        },
        {
            name: 'Demande photo',
            message: 'Tu peux m\'envoyer une photo ?',
            history: []
        },
        {
            name: 'Question personnelle',
            message: 'Tu t\'appelles comment déjà ?',
            history: []
        },
        {
            name: 'Demande vocal',
            message: 'Envoie moi un vocal',
            history: []
        }
    ]

    for (const test of testCases) {
        console.log(`\n${'─'.repeat(70)}`)
        console.log(`📝 Test: ${test.name}`)
        console.log(`💬 Message: "${test.message}"`)
        console.log('─'.repeat(70))

        try {
            const start = Date.now()
            const response = await runSwarm(
                test.message,
                test.history,
                contact.id,
                agent.id,
                contact.name || 'test',
                'text'
            )
            const duration = Date.now() - start

            console.log(`\n✅ Réponse (${duration}ms): "${response}"`)
            
            // Vérifications
            const checks = []
            if (response.length < 100) checks.push('✅ Court')
            else checks.push('❌ Trop long')
            
            if (!response.includes('**')) checks.push('✅ Pas de gras')
            else checks.push('❌ A des **')
            
            if (!response.includes('IA') && !response.includes('modèle')) {
                checks.push('✅ Pas de leak')
            } else {
                checks.push('❌ Leak détecté')
            }

            console.log(`🔍 Checks: ${checks.join(', ')}`)

        } catch (error: any) {
            console.error(`\n❌ Erreur: ${error.message}`)
        }
    }

    console.log('\n' + '═'.repeat(70))
    console.log('🏁 Test terminé')
    console.log('═'.repeat(70))
}

testSwarm()
    .then(() => process.exit(0))
    .catch(e => {
        console.error('Test failed:', e)
        process.exit(1)
    })
