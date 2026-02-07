/**
 * TEST COMPLET - Style ado FR authentique
 * Vérifie qu'Anaïs parle bien comme une vraie ado française (pas de maj, abréviations)
 */
import { prisma } from '../lib/prisma'
import { runSwarm } from '../lib/swarm'
import { aiConfig } from '../lib/config/ai-mode'

async function testFRStyle() {
  console.log('🇫🇷 TEST STYLE ADO FRANÇAIS AUTHENTIQUE\n')
  console.log('Objectif: Vérifier qu\'Anaïs parle comme une vraie ado FR\n')
  console.log('Critères:')
  console.log('- ✅ Pas de majuscules au début')
  console.log('- ✅ Abbréviations: jsuis, tkt, bcp, grave, trop, ouf, chelou')
  console.log('- ✅ Pas de ponctuation (points/virgules)')
  console.log('- ✅ Réponses courtes (2-6 mots)')
  console.log('- ✅ "jsuis" au lieu de "je suis"')
  console.log('')

  // Force SWARM mode
  aiConfig.setMode('SWARM')
  
  // Récupérer l'agent Anaïs (français)
  const anais = await prisma.agent.findFirst({
    where: { 
      OR: [
        { name: { contains: 'Anaïs', mode: 'insensitive' } },
        { phone: { contains: '3374' } } // Anaïs a un numéro FR
      ]
    },
    include: { profile: true }
  })

  if (!anais) {
    console.log('❌ Agent Anaïs non trouvée')
    process.exit(1)
  }

  console.log(`Agent trouvé: ${anais.name} (${anais.id})`)
  console.log(`Locale: ${anais.profile?.locale || 'non définie'}`)
  console.log(`Âge: ${anais.profile?.baseAge || 15}`)
  console.log('')

  // Créer un contact test
  const testPhone = `+TEST_FR_${Date.now()}`
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
      agentId: anais.id,
      promptId: defaultPrompt?.id || 1,
      status: 'active',
      ai_enabled: true
    }
  })

  // Créer AgentContact pour la phase
  await prisma.agentContact.create({
    data: {
      agentId: anais.id,
      contactId: contact.id,
      phase: 'CONNECTION',
      signals: [],
      trustScore: 50
    }
  })

  const testMessages = [
    "salut ça va",
    "tu viens d'où",
    "t'es cool",
    "tu fais quoi",
    "envoie une photo"
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
        anais.id,
        'TestUser',
        'text',
        'whatsapp'
      )
      
      responses.push(response)
      console.log(`Anaïs: "${response}"`)
      
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
  let hasJeSuis = 0
  let shortResponses = 0
  
  const abbreviations = ['jsuis', 'tkt', 'bcp', 'grave', 'trop', 'ouf', 'chelou', 'nul', 'bof', 'chui', 'j']
  
  responses.forEach((resp, i) => {
    // Check majuscules au début (sauf noms propres)
    const firstChar = resp.trim()[0]
    if (firstChar && firstChar === firstChar.toUpperCase() && !['J'].includes(firstChar)) {
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
    
    // Check "je suis" (pas "jsuis")
    if (/\bje suis\b/i.test(resp)) {
      hasJeSuis++
      console.log(`⚠️  Test ${i+1}: "je suis" au lieu de "jsuis"`)
    }
    
    // Check longueur
    const wordCount = resp.split(/\s+/).length
    if (wordCount <= 6) shortResponses++
    
    console.log(`Test ${i+1}: ${wordCount} mots${hasAbbr ? ' ✅ abbréviation' : ''}`)
  })
  
  console.log('')
  console.log(`Réponses analysées: ${responses.length}`)
  console.log(`Avec majuscules au début: ${hasUppercase} (objectif: 0)`)
  console.log(`Avec ponctuation finale: ${hasPunctuation} (objectif: 0)`)
  console.log(`Avec "je suis" (non abbrégé): ${hasJeSuis} (objectif: 0)`)
  console.log(`Avec abbréviations ado: ${hasAbbreviations}/${responses.length} (objectif: ${responses.length})`)
  console.log(`Réponses courtes (≤6 mots): ${shortResponses}/${responses.length} (objectif: ${responses.length})`)
  
  // Score final
  const score = (
    (hasUppercase === 0 ? 20 : 0) +
    (hasPunctuation === 0 ? 20 : 0) +
    (hasJeSuis === 0 ? 20 : 0) +
    (hasAbbreviations >= responses.length * 0.6 ? 20 : 0) +
    (shortResponses >= responses.length * 0.8 ? 20 : 0)
  )
  
  console.log('')
  console.log(`Score final: ${score}/100`)
  
  if (score >= 75) {
    console.log('✅ TEST RÉUSSI - Style FR authentique!')
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
  if (firstChar && firstChar === firstChar.toUpperCase() && !['J'].includes(firstChar)) {
    issues.push('❌ majuscule au début')
  }
  
  // Check ponctuation
  if (/[.!,;?]$/.test(response.trim())) {
    issues.push('❌ ponctuation finale')
  }
  
  // Check phrases complètes
  if (/\bje suis\b/i.test(response)) {
    issues.push('❌ "je suis" non abbrégé')
  }
  
  // Check bonnes abbréviations
  const abbreviations = ['jsuis', 'tkt', 'bcp', 'grave', 'trop', 'ouf', 'chelou']
  const hasGoodAbbr = abbreviations.some(abbr => response.toLowerCase().includes(abbr))
  if (hasGoodAbbr) {
    issues.push('✅ abbréviation ado FR')
  }
  
  if (issues.length > 0) {
    console.log('   Analyse:', issues.join(' | '))
  }
}

testFRStyle().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
