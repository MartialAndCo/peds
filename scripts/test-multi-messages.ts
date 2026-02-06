/**
 * Test: 10 messages simultanés pour vérifier le rate limiting
 */
import { prisma } from '@/lib/prisma'
import { runSwarm } from '@/lib/swarm'

async function testMultiMessages() {
    console.log('🧪 Test: 10 messages simultanés\n')
    
    const TEST_AGENT_ID = 'cmkvfuyar00004uaximi0hhqw'
    const TEST_MESSAGES = [
        "salut",
        "ça va ?",
        "tu fais quoi",
        "raconte",
        "cool",
        "ok",
        "et après",
        "grave",
        "mdr",
        "bonne nuit"
    ]
    
    // Trouver un contact de test
    const contact = await prisma.contact.findFirst({
        where: { conversations: { some: { agentId: TEST_AGENT_ID } } }
    })
    
    if (!contact) {
        console.log('❌ Pas de contact trouvé pour cet agent')
        return
    }
    
    console.log(`Contact: ${contact.name || contact.phone_whatsapp}`)
    console.log(`Envoi de ${TEST_MESSAGES.length} messages...\n`)
    
    const results: Array<{msg: string, response: string, duration: number}> = []
    const startTime = Date.now()
    
    for (let i = 0; i < TEST_MESSAGES.length; i++) {
        const msg = TEST_MESSAGES[i]
        const msgStart = Date.now()
        
        try {
            console.log(`[${i+1}/${TEST_MESSAGES.length}] "${msg}"...`)
            
            const response = await runSwarm(
                msg,
                [],
                contact.id,
                TEST_AGENT_ID,
                contact.name || 'User',
                'text'
            )
            
            const duration = Date.now() - msgStart
            results.push({msg, response, duration})
            
            console.log(`   ✅ ${duration}ms: "${response.substring(0, 50)}${response.length > 50 ? '...' : ''}"`)
            
        } catch (error: any) {
            const duration = Date.now() - msgStart
            results.push({msg, response: `ERROR: ${error.message}`, duration})
            console.log(`   ❌ ${duration}ms: ${error.message}`)
        }
    }
    
    const totalTime = Date.now() - startTime
    
    // Stats
    console.log('\n' + '='.repeat(60))
    console.log('RÉSULTATS:')
    console.log('='.repeat(60))
    console.log(`Total: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`)
    console.log(`Moyenne par message: ${(totalTime/TEST_MESSAGES.length).toFixed(0)}ms`)
    console.log(`Succès: ${results.filter(r => !r.response.includes('ERROR')).length}/${TEST_MESSAGES.length}`)
    
    // Vérifier si on respecte les 150 RPM
    const avgTimePerMessage = totalTime / TEST_MESSAGES.length
    const messagesPerMinute = 60000 / avgTimePerMessage
    console.log(`\nDébit estimé: ${messagesPerMinute.toFixed(0)} messages/minute`)
    console.log(`Limite Venice: 150 RPM = ${messagesPerMinute > 150 ? '❌ DÉPASSÉ' : '✅ OK'}`)
    
    // Détail des erreurs
    const errors = results.filter(r => r.response.includes('ERROR'))
    if (errors.length > 0) {
        console.log('\n❌ Erreurs:')
        errors.forEach(e => console.log(`   - "${e.msg}": ${e.response}`))
    }
    
    await prisma.$disconnect()
}

testMultiMessages()
