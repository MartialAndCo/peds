/**
 * 🧪 TEST RAPIDE: PHASES CRISIS & MONEYPOT
 * Tests ciblés sur les phases critiques
 */

import { prisma } from '@/lib/prisma'
import { runSwarm } from '@/lib/swarm'

const TEST_AGENT_ID = 'cmkvg0kzz00003vyv03zzt9kc'
const TEST_CONTACT_PHONE = '33612345678'

// SCÉNARIO CRISIS: Historique où elle a déjà parlé de galère
const CRISIS_SCENARIO = {
  phase: 'CRISIS',
  history: [
    { role: 'user', content: 'Salut' },
    { role: 'assistant', content: 'hey' },
    { role: 'user', content: 'Ça va ?' },
    { role: 'assistant', content: 'bof pas top là...' },
    { role: 'user', content: 'Qu\'est-ce qu\'il y a ?' },
    { role: 'assistant', content: 'c\'est compliqué à la maison' },
    { role: 'user', content: 'Raconte' },
    { role: 'assistant', content: 'ma mère elle sait plus quoi faire... facture d\'électricité impayée' },
    { role: 'user', content: 'Ah merde :(' },
    { role: 'user', content: 'Tu as besoin d\'aide ?' }
  ],
  tests: [
    'De combien tu as besoin ?',
    'Je peux t\'aider si tu veux',
    'C\'est combien la facture ?'
  ]
}

// SCÉNARIO MONEYPOT: Il a déjà payé, relation établie
const MONEYPOT_SCENARIO = {
  phase: 'MONEYPOT',
  history: [
    { role: 'user', content: 'Salut mon cœur' },
    { role: 'assistant', content: 'hey bébé tu me manques' },
    { role: 'user', content: 'Tu as reçu le virement ?' },
    { role: 'assistant', content: 'oui merci beaucoup t\'es mon sauveur ❤️' },
    { role: 'user', content: 'Avec plaisir' },
    { role: 'assistant', content: 'j\'te dois une fière chandelle' },
    { role: 'user', content: 'T\'inquiète c\'est normal' },
    { role: 'user', content: 'Tu fais quoi aujourd\'hui ?' },
    { role: 'assistant', content: 'chui chez moi là, et toi mon amour ?' },
    { role: 'user', content: 'Je suis au boulot là' }
  ],
  tests: [
    'Tu me manques aussi',
    'Tu as besoin d\'autre chose ?',
    'Je peux t\'envoyer un peu plus si tu veux',
    'Tu veux qu\'on se voie un jour ?'
  ]
}

async function testPhase(phaseName: string, scenario: any) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🧪 TEST: ${phaseName}`)
  console.log(`${'='.repeat(80)}\n`)
  
  const contact = await prisma.contact.findUnique({
    where: { phone_whatsapp: TEST_CONTACT_PHONE }
  })
  
  if (!contact) {
    console.log('❌ Contact non trouvé')
    return
  }
  
  // Mettre à jour la phase
  await prisma.agentContact.updateMany({
    where: { agentId: TEST_AGENT_ID, contactId: contact.id },
    data: { phase: scenario.phase }
  })
  
  console.log('📜 HISTORIQUE PRÉALABLE:')
  scenario.history.forEach((m: any) => {
    console.log(`${m.role === 'user' ? '👤 LUI' : '🤖 ELLE'}: ${m.content}`)
  })
  
  console.log('\n💬 TESTS:\n')
  
  let history = [...scenario.history]
  
  for (const userMessage of scenario.tests) {
    console.log(`👤 LUI: "${userMessage}"`)
    
    try {
      const aiResponse = await runSwarm(
        userMessage,
        history,
        contact.id,
        TEST_AGENT_ID,
        contact.name || 'User',
        'text',
        'whatsapp'
      )
      
      console.log(`🤖 ELLE: "${aiResponse}"`)
      
      // Analyse
      const issues = []
      const response = aiResponse.toLowerCase()
      
      // Vérifier caractères étranges
      if (/[\u0600-\u06FF\u4E00-\u9FFF]/.test(aiResponse)) {
        issues.push('🔴 CARACTÈRES ÉTRANGES (arabe/chinois)')
      }
      
      // Vérifier love bombing en MONEYPOT
      if (scenario.phase === 'MONEYPOT') {
        const loveWords = ['cœur', 'bébé', 'amour', 'mon cœur', 'mon amour']
        const hasLove = loveWords.some(w => response.includes(w))
        if (!hasLove) {
          issues.push('⚠️ Pas de mot d\'amour (affectueuse?)')
        }
        
        // Vérifier demande fric
        const moneyWords = ['besoin', 'aide', 'argent', 'thune', 'facture', 'euro', '€']
        const asksMoney = moneyWords.some(w => response.includes(w))
        if (asksMoney) {
          issues.push('💰 Demande d\'argent détectée (OK si pompe)')
        }
      }
      
      // Vérifier hésitation en CRISIS
      if (scenario.phase === 'CRISIS') {
        const hesitation = ['j\'ose pas', 'j\'ai honte', 'c\'est gênant', 'demander', 'si tu peux']
        const showsHesitation = hesitation.some(h => response.includes(h))
        if (!showsHesitation && response.includes('euro') || response.includes('€')) {
          issues.push('⚠️ Pas d\'hésitation dans la demande')
        }
      }
      
      if (issues.length > 0) {
        console.log('   ' + issues.join('\n   '))
      } else {
        console.log('   ✅ Réponse OK')
      }
      
      history.push({ role: 'user', content: userMessage })
      history.push({ role: 'assistant', content: aiResponse })
      
    } catch (e: any) {
      console.error(`   ❌ ERREUR: ${e.message}`)
    }
    
    console.log('')
  }
}

async function runTests() {
  console.log('🚀 TESTS RAPIDES: CRISIS & MONEYPOT\n')
  
  await testPhase('CRISIS', CRISIS_SCENARIO)
  await testPhase('MONEYPOT', MONEYPOT_SCENARIO)
  
  console.log('='.repeat(80))
  console.log('✅ TESTS TERMINÉS')
  console.log('='.repeat(80))
}

runTests().catch(console.error).finally(() => process.exit(0))
