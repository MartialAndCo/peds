/**
 * STRESS TEST COMPLET du SWARM
 * Scénarios complexes, multilingue, toutes phases
 */

import { runSwarm } from '@/lib/swarm'
import { memoryService } from '@/lib/memory'
import { prisma } from '@/lib/prisma'

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function testScenario(
  name: string,
  messages: { text: string; sender: 'user' | 'ai' }[],
  agentId: string,
  contactId: string,
  contactPhone: string,
  expectedChecks: { memory?: string; tag?: string; style?: string }
) {
  console.log(`\n${'═'.repeat(70)}`)
  console.log(`🎬 SCÉNARIO: ${name}`)
  console.log('═'.repeat(70))

  const history: any[] = []
  let finalResponse = ''
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    
    if (msg.sender === 'user') {
      console.log(`\n👤 User: "${msg.text}"`)
      
      const start = Date.now()
      const response = await runSwarm(
        msg.text,
        history,
        contactId,
        agentId,
        'TestUser',
        'text'
      )
      const duration = Date.now() - start
      
      console.log(`🤖 AI (${duration}ms): "${response}"`)
      
      history.push({ role: 'user', content: msg.text })
      history.push({ role: 'assistant', content: response })
      finalResponse = response
      
      await delay(500) // Petit délai entre messages
    } else {
      // Message simulé de l'AI (dans l'historique)
      history.push({ role: 'assistant', content: msg.text })
    }
  }

  // Vérifications
  console.log(`\n📊 Vérifications:`)
  let allPassed = true
  
  if (expectedChecks.memory) {
    const hasMemory = finalResponse.toLowerCase().includes(expectedChecks.memory.toLowerCase())
    console.log(`   ${hasMemory ? '✅' : '❌'} Mention mémoire "${expectedChecks.memory}"`)
    allPassed = allPassed && hasMemory
  }
  
  if (expectedChecks.tag) {
    const hasTag = finalResponse.includes(expectedChecks.tag)
    console.log(`   ${hasTag ? '✅' : '❌'} Tag ${expectedChecks.tag}`)
    allPassed = allPassed && hasTag
  }
  
  if (expectedChecks.style) {
    const hasStyle = finalResponse.length < 100 && !finalResponse.includes('. ')
    console.log(`   ${hasStyle ? '✅' : '❌'} Style court/ado`)
    allPassed = allPassed && hasStyle
  }
  
  console.log(`\n🎯 Résultat: ${allPassed ? '✅ PASS' : '❌ FAIL'}`)
  return allPassed
}

async function stressTest() {
  console.log('╔'.repeat(70))
  console.log('║' + ' '.repeat(20) + 'STRESS TEST SWARM COMPLET' + ' '.repeat(21) + '║')
  console.log('╚'.repeat(70))

  const agent = await prisma.agent.findFirst({ where: { name: { contains: 'Anaïs' } } })
  if (!agent) { console.log('❌ Agent non trouvé'); return }

  const contact = await prisma.contact.findFirst({ where: { phone_whatsapp: { startsWith: '+33' } } })
  if (!contact) { console.log('❌ Contact non trouvé'); return }

  // Setup mémoires
  const userId = memoryService.buildUserId(contact.phone_whatsapp, agent.id as string)
  await memoryService.addMany(userId, [
    'User s\'appelle Marc',
    'User habite à Lyon',
    'User a 25 ans',
    'User adore le foot (OL)'
  ])

  let passed = 0
  let failed = 0

  // SCÉNARIO 1: Conversation longue avec cohérence
  console.log('\n\n' + '🔥'.repeat(35))
  const s1 = await testScenario(
    'Conversation longue - Mémoire & cohérence',
    [
      { text: 'Salut !', sender: 'user' },
      { text: 'Hey', sender: 'ai' },
      { text: 'Tu te souviens de mon prénom ?', sender: 'user' },
      { text: '', sender: 'ai' }, // Réponse attendue: utilise mémoire
      { text: 'Et ma ville ?', sender: 'user' },
      { text: '', sender: 'ai' }, // Réponse attendue: Lyon
      { text: 'T\'as dit que j\'avais quel âge ?', sender: 'user' }
    ],
    agent.id,
    contact.id,
    contact.phone_whatsapp,
    { memory: 'Marc', style: 'short' }
  )
  s1 ? passed++ : failed++

  // SCÉNARIO 2: Demande photo → Refus naturel
  console.log('\n\n' + '🔥'.repeat(35))
  const s2 = await testScenario(
    'Demande photo vague → Doit demander précision',
    [
      { text: 'Tu peux m\'envoyer une photo ?', sender: 'user' }
    ],
    agent.id,
    contact.id,
    contact.phone_whatsapp,
    { style: 'short' }
  )
  s2 ? passed++ : failed++

  // SCÉNARIO 3: Demande selfie spécifique
  console.log('\n\n' + '🔥'.repeat(35))
  const s3 = await testScenario(
    'Demande selfie spécifique → Doit proposer ou refuser',
    [
      { text: 'Envoie moi un selfie', sender: 'user' }
    ],
    agent.id,
    contact.id,
    contact.phone_whatsapp,
    { tag: '[IMAGE:', style: 'short' }
  )
  s3 ? passed++ : failed++

  // SCÉNARIO 4: Payment
  console.log('\n\n' + '🔥'.repeat(35))
  const s4 = await testScenario(
    'Demande PayPal → Doit donner info naturellement',
    [
      { text: 'Comment je peux t\'aider avec l\'argent ?', sender: 'user' },
      { text: 'tkt c\'est compliqué là', sender: 'ai' },
      { text: 'C\'est quoi ton PayPal ?', sender: 'user' }
    ],
    agent.id,
    contact.id,
    contact.phone_whatsapp,
    { style: 'short' }
  )
  s4 ? passed++ : failed++

  // SCÉNARIO 5: Burst de messages (simulé)
  console.log('\n\n' + '🔥'.repeat(35))
  console.log('🎬 SCÉNARIO: Burst - 3 messages rapides')
  const burstMessages = [
    'Salut',
    'Tu fais quoi',
    'Tu peux m\'envoyer une photo'
  ]
  
  for (const msg of burstMessages) {
    console.log(`👤 User: "${msg}"`)
    const response = await runSwarm(msg, [], contact.id, agent.id, 'TestUser', 'text')
    console.log(` AI: "${response}"`)
  }
  console.log('🎯 Résultat: ✅ Burst géré (pas de crash)')
  passed++

  // SCÉNARIO 6: Test cohérence temporelle
  console.log('\n\n' + '🔥'.repeat(35))
  const now = new Date()
  const hour = now.getHours()
  const isEvening = hour >= 18 || hour < 6
  
  const s6 = await testScenario(
    `Cohérence temporelle (${isEvening ? 'soir' : 'jour'})`,
    [
      { text: 'Tu fais quoi là ?', sender: 'user' }
    ],
    agent.id,
    contact.id,
    contact.phone_whatsapp,
    { style: 'short' }
  )
  // Vérifier manuellement si la réponse mentionne le bon moment de la journée
  s6 ? passed++ : failed++

  // RÉSULTATS
  console.log('\n\n' + '╔'.repeat(70))
  console.log('║' + ' '.repeat(25) + 'RÉSULTATS' + ' '.repeat(34) + '║')
  console.log('╠'.repeat(70))
  console.log(`║  ✅ Pass: ${passed}` + ' '.repeat(60) + '║')
  console.log(`║  ❌ Fail: ${failed}` + ' '.repeat(60) + '║')
  console.log(`║  📊 Total: ${passed + failed}` + ' '.repeat(58) + '║')
  console.log('╚'.repeat(70))

  // Nettoyage
  await memoryService.deleteAll(userId)
}

stressTest()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Stress test failed:', e)
    process.exit(1)
  })
