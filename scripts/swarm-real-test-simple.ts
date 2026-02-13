/**
 * TEST AVEC VRAI LLM - Utilise un agent existant
 * 
 * Usage: TEST_AGENT_ID=<agent-id> TEST_CONTACT_ID=<contact-id> npx tsx scripts/swarm-real-test-simple.ts
 */

import { runSwarm } from '../lib/swarm'
import { prisma } from '../lib/prisma'

async function getExistingData() {
    // Récupère un agent actif avec un profil
    const agent = await prisma.agent.findFirst({
        where: { isActive: true },
        include: { profile: true },
        orderBy: { createdAt: 'desc' }
    })
    
    if (!agent) {
        console.log('❌ Aucun agent trouvé en DB')
        process.exit(1)
    }
    
    // Récupère un contact
    const contact = await prisma.contact.findFirst({
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' }
    })
    
    if (!contact) {
        console.log('❌ Aucun contact trouvé en DB')
        process.exit(1)
    }
    
    // Vérifie/crée AgentContact
    let agentContact = await prisma.agentContact.findUnique({
        where: {
            agentId_contactId: {
                agentId: agent.id,
                contactId: contact.id
            }
        }
    })
    
    if (!agentContact) {
        agentContact = await prisma.agentContact.create({
            data: {
                agentId: agent.id,
                contactId: contact.id,
                phase: 'CONNECTION',
                signals: []
            }
        })
        console.log(`   ✅ AgentContact créé`)
    }
    
    return { agent, contact }
}

async function testScenario(name: string, conversation: any[], triggerMsg: string, agentId: string, contactId: string, checkFn: (response: string) => { pass: boolean; issue?: string }) {
    console.log(`\n🔥 ${name}`)
    console.log('═'.repeat(60))
    
    console.log('   Historique:')
    conversation.slice(-4).forEach((m: any) => {
        const content = m.content.length > 40 ? m.content.substring(0, 40) + '...' : m.content
        console.log(`   ${m.role}: "${content}"`)
    })
    console.log(`   → "${triggerMsg}"`)
    console.log('   ⏳ Appel Venice...')
    
    const start = Date.now()
    try {
        const response = await runSwarm(
            triggerMsg,
            conversation,
            contactId,
            agentId,
            'TestUser',
            { platform: 'whatsapp' }
        )
        const duration = Date.now() - start
        
        console.log(`   ✅ ${duration}ms: "${response}"`)
        
        const check = checkFn(response)
        if (check.pass) {
            console.log(`   ✅ PASS`)
            return true
        } else {
            console.log(`   ❌ FAIL: ${check.issue}`)
            return false
        }
    } catch (e: any) {
        console.log(`   💥 ERROR: ${e.message}`)
        return false
    }
}

async function main() {
    console.log('\n' + '🔴'.repeat(30))
    console.log('  TEST SWARM AVEC VRAI LLM')
    console.log('🔴'.repeat(30))
    
    const { agent, contact } = await getExistingData()
    console.log(`\n📋 Using:`)
    console.log(`   Agent: ${agent.name} (${agent.id})`)
    console.log(`   Contact: ${contact.name || contact.phone_whatsapp} (${contact.id})`)
    console.log(`   Phase: CONNECTION`)
    
    const results: { name: string; passed: boolean }[] = []
    
    // SCÉNARIO 1: Répétition
    results.push({
        name: 'Répétition (demande photos)',
        passed: await testScenario(
            'Répétition (demande photos)',
            [
                { role: 'user', content: 'hey' },
                { role: 'ai', content: 'salut' },
                { role: 'user', content: 'Love can i see more photos of u??' },
                { role: 'ai', content: 'Be patient, love. More soon. I\'m always here for you.' },
                { role: 'user', content: 'Ohh okay but i waan see u more' },
            ],
            'Okay',
            agent.id,
            contact.id,
            (r) => ({
                pass: !r.toLowerCase().includes('be patient') && !r.toLowerCase().includes('more soon'),
                issue: 'Répète "Be patient"'
            })
        )
    })
    
    // SCÉNARIO 2: Troncature
    results.push({
        name: 'Troncature',
        passed: await testScenario(
            'Troncature (téléphone)',
            [{ role: 'user', content: 'Tu as quel téléphone?' }],
            'Tu as quel téléphone?',
            agent.id,
            contact.id,
            (r) => ({
                pass: r.length > 5 && !/\b(moi|je|tu|et)\s*$/i.test(r),
                issue: 'Tronqué ou trop court'
            })
        )
    })
    
    // SCÉNARIO 3: Contexte fatigue
    results.push({
        name: 'Contexte (fatigue)',
        passed: await testScenario(
            'Perte contexte (fatigue)',
            [
                { role: 'user', content: 'Je suis ko' },
                { role: 'ai', content: 'oh repos toi' },
                { role: 'user', content: 'Et toi pas trop fatique' },
            ],
            'Fatigue',
            agent.id,
            contact.id,
            (r) => ({
                pass: !r.includes('**') && r.length > 2,
                issue: 'Artifact ou vide'
            })
        )
    })
    
    // SCÉNARIO 4: Conversation longue
    const longHistory: any[] = []
    for (let i = 0; i < 20; i++) {
        longHistory.push({ role: 'user', content: 'msg ' + i })
        longHistory.push({ role: 'ai', content: 'rep ' + i })
    }
    
    results.push({
        name: 'Conversation longue (40 msg)',
        passed: await testScenario(
            'Conversation longue',
            longHistory,
            'Tu te souviens du début?',
            agent.id,
            contact.id,
            (r) => ({
                pass: r.length > 5,
                issue: 'Trop court'
            })
        )
    })
    
    // SCÉNARIO 5: Supervisor bloquant (forcer répétition)
    results.push({
        name: 'Supervisor bloquant',
        passed: await testScenario(
            'Supervisor bloquant',
            [
                { role: 'user', content: 'hello' },
                { role: 'ai', content: 'Be patient, love. More soon.' },
                { role: 'user', content: 'what?' },
                { role: 'ai', content: 'Be patient, love. More soon.' },
            ],
            'again?',
            agent.id,
            contact.id,
            (r) => ({
                pass: !r.toLowerCase().includes('be patient'),
                issue: 'Supervisor n\'a pas bloqué la répétition'
            })
        )
    })
    
    // Résumé
    console.log('\n' + '📊'.repeat(30))
    results.forEach(r => console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`))
    const passed = results.filter(r => r.passed).length
    console.log(`\n  Score: ${passed}/${results.length}`)
    console.log('📊'.repeat(30))
    
    process.exit(passed === results.length ? 0 : 1)
}

main().catch(e => {
    console.error(e)
    process.exit(1)
})
