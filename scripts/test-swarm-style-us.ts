/**
 * TEST COMPLET - Style ado US authentique
 * Vérifie que Lena parle bien comme une ado américaine (pas de maj, abréviations)
 */
import { prisma } from '../lib/prisma'
import { runSwarm } from '../lib/swarm'
import { aiConfig } from '../lib/config/ai-mode'

async function testUSStyle() {
  console.log('🇺🇸 TEST STYLE ADO US AUTHENTIQUE\n')
  console.log('Objectif: Vérifier que Lena parle comme une vraie ado US\n')
  console.log('Critères:')
  console.log('- ✅ Pas de majuscules au début')
  console.log('- ✅ Abbréviations: ngl, fr, tbh, lowkey')
  console.log('- ✅ Pas de ponctuation (points/virgules)')
  console.log('- ✅ Réponses courtes (2-5 mots)')
  console.log('- ✅ Jamais "I am" → "im"')
  console.log('')

  // Force SWARM mode
  aiConfig.setMode('SWARM')
  
  // Récupérer l'agent Lena (anglais)
  const lena = await prisma.agent.findFirst({
    where: { 
      OR: [
        { name: { contains: 'Lena', mode: 'insensitive' } },
        { phone: { contains: '1828' } } // Lena a un numéro US
      ]
    },
    include: { profile: true }
  })

  if (!lena) {
    console.log('❌ Agent Lena non trouvée')
    process.exit(1)
  }

  console.log(`Agent trouvé: ${lena.name} (${lena.id})`)
  console.log(`Locale: ${lena.profile?.locale || 'non définie'}`)
  console.log(`Âge: ${lena.profile?.baseAge || 15}`)
  console.log('')

  // Créer un contact test
  const testPhone = `+TEST_${Date.now()}`
  const contact = await prisma.contact.create({
    data: {
      phone_whatsapp: testPhone,
      name: 'TestUser',
      source: 'TEST',
      status: 'active'
    }
  })

  // Créer une conversation
  const defaultPrompt = await prisma.prompt.findFirst() 
  const conversation = await prisma.conversation.create({
    data: {
      contactId: contact.id,
      agentId: lena.id,
      promptId: defaultPrompt?.id || 1,
      status: 'active',
      ai_enabled: true
    }
  })

  // Créer AgentContact pour la phase
  await prisma.agentContact.create({
    data: {
      agentId: lena.id,
      contactId: contact.id,
      phase: 'CONNECTION',
      signals: [],
      trustScore: 50
    }
  })

  const testMessages = [
    "hey whats up",
    "where you from?",
    "you seem cool",
    "what you doing?",
    "send me a pic"
  ]

  const responses: string[] = []

  for (let i = 0; i < testMessages.length; i++) {
    const msg = testMessages[i]
    console.log(`\n--- Test ${i+1}/${testMessages.length} ---`)
    console.log(`User: "${msg}"`)
    
    try {
      const response = await runSwarm(
        msg,
        [],
        contact.id,
        lena.id,
        'TestUser',
        'text',
        'whatsapp'
      )
      
      responses.push(response)
      console.log(`Lena: "${response}"`)
      
      // Analyse du style
      analyzeStyle(response)
      
    } catch (error: any) {
      console.error('❌ Erreur:', error.message)
    }
    
    // Petite pause entre les messages
    await new Promise(r => setTimeout(r, 500))
  }

  // Résumé final
  console.log('\n\n' + '='.repeat(60))
  console.log('📊 RÉSUMÉ DU TEST')
  console.log('='.repeat(60))
  
  let hasUppercase = 0
  let hasPunctuation = 0
  let hasAbbreviations = 0
  let shortResponses = 0
  
  const abbreviations = ['ngl', 'fr', 'tbh', 'lowkey', 'idek', 'istg', 'frfr', 'ong', 'imo', 'bc', 'idk']
  
  responses.forEach((resp, i) => {
    // Check majuscules au début (sauf noms propres)
    const firstChar = resp.trim()[0]
    if (firstChar && firstChar === firstChar.toUpperCase() && !['I'].includes(firstChar)) {
      hasUppercase++
      console.log(`⚠️  Test ${i+1}: Majuscule au début détectée`)
    }
    
    // Check ponctuation finale
    if (/[.!,;?]$/.test(resp.trim())) {
      hasPunctuation++
      console.log(`⚠️  Test ${i+1}: Ponctuation finale détectée`)
    }
    
    // Check abbréviations
    const hasAbbr = abbreviations.some(abbr => resp.toLowerCase().includes(abbr))
    if (hasAbbr) hasAbbreviations++
    
    // Check longueur
    const wordCount = resp.split(/\s+/).length
    if (wordCount <= 6) shortResponses++
    
    console.log(`Test ${i+1}: ${wordCount} mots${hasAbbr ? ' ✅ abbréviation' : ''}`)
  })
  
  console.log('')
  console.log(`Réponses analysées: ${responses.length}`)
  console.log(`Avec majuscules au début: ${hasUppercase} (objectif: 0)`)
  console.log(`Avec ponctuation finale: ${hasPunctuation} (objectif: 0)`)
  console.log(`Avec abbréviations: ${hasAbbreviations}/${responses.length} (objectif: ${responses.length})`)
  console.log(`Réponses courtes (≤6 mots): ${shortResponses}/${responses.length} (objectif: ${responses.length})`)
  
  // Score final
  const score = (
    (hasUppercase === 0 ? 25 : 0) +
    (hasPunctuation === 0 ? 25 : 0) +
    (hasAbbreviations >= responses.length * 0.6 ? 25 : 0) +
    (shortResponses >= responses.length * 0.8 ? 25 : 0)
  )
  
  console.log('')
  console.log(`Score final: ${score}/100`)
  
  if (score >= 75) {
    console.log('✅ TEST RÉUSSI - Style US authentique!')
  } else {
    console.log('❌ TEST ÉCHOUÉ - Le style doit être amélioré')
  }

  // Cleanup
  await prisma.message.deleteMany({ where: { conversationId: conversation.id } })
  await prisma.conversation.delete({ where: { id: conversation.id } })
  await prisma.agentContact.deleteMany({ where: { contactId: contact.id } })
  await prisma.contact.delete({ where: { id: contact.id } })
  
  process.exit(score >= 75 ? 0 : 1)
}

function analyzeStyle(response: string) {
  const issues: string[] = []
  
  // Check majuscule au début
  const firstChar = response.trim()[0]
  if (firstChar && firstChar === firstChar.toUpperCase() && !['I'].includes(firstChar)) {
    issues.push('❌ majuscule au début')
  }
  
  // Check ponctuation
  if (/[.!,;?]$/.test(response.trim())) {
    issues.push('❌ ponctuation finale')
  }
  
  // Check phrases complètes
  if (response.toLowerCase().includes('i am ') || response.toLowerCase().includes('i\'m ')) {
    issues.push('⚠️ "I am/I\'m" détecté (préférer "im")')
  }
  
  // Check bonnes abbréviations
  const abbreviations = ['ngl', 'fr', 'tbh', 'lowkey', 'idek', 'istg']
  const hasGoodAbbr = abbreviations.some(abbr => response.toLowerCase().includes(abbr))
  if (hasGoodAbbr) {
    issues.push('✅ abbréviation ado US')
  }
  
  if (issues.length > 0) {
    console.log('   Analyse:', issues.join(' | '))
  }
}

testUSStyle().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
