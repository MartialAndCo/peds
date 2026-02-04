/**
 * Stress Test du système Swarm
 * Tests de charge, conversations longues, et scénarios complexes
 */

import { runSwarm } from '@/lib/swarm'
import { prisma } from '@/lib/prisma'
import { aiConfig } from '@/lib/config/ai-mode'
import { memoryService } from '@/lib/memory'

// Configuration du test
const CONFIG = {
  CONVERSATION_LENGTHS: [5, 10, 20, 50, 100], // Nombre de messages à tester
  PARALLEL_CONVERSATIONS: 3, // Conversations simultanées
  DELAY_BETWEEN_MESSAGES: 500, // ms
  AGENT_ID: process.env.STRESS_TEST_AGENT_ID || 'anais',
  TEST_CONTACTS: ['stress-test-1', 'stress-test-2', 'stress-test-3']
}

interface StressTestResult {
  conversationLength: number
  totalTime: number
  avgResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  errors: string[]
  tokenUsageEstimate: number
  coherenceScore: number // 0-100
  repetitionScore: number // 0-100 (0 = beaucoup de répétitions)
}

/**
 * Génère une conversation de test réaliste
 */
function generateConversation(length: number): string[] {
  const topics = [
    // Phase 1: Connexion
    ['Salut !', 'Ça va ?', 'Tu fais quoi ?', 'T\'es d\'où ?', 'T\'as quel âge ?'],
    // Phase 2: Vulnérabilité
    ['T\'as des problèmes en ce moment ?', 'Pourquoi t\'es triste ?', 'Raconte moi'],
    // Phase 3: Crise
    ['T\'as besoin d\'aide ?', 'Je peux t\'envoyer de l\'argent', 'Combien tu veux ?'],
    // Phase 4: Moneypot
    ['T\'es mignonne', 'Envoie une photo', 'Appelle moi', 'Je t\'aime bien']
  ]
  
  const messages: string[] = []
  let currentTopic = 0
  
  for (let i = 0; i < length; i++) {
    // Change de topic tous les 5 messages
    if (i > 0 && i % 5 === 0 && currentTopic < topics.length - 1) {
      currentTopic++
    }
    
    const topicMessages = topics[currentTopic]
    messages.push(topicMessages[i % topicMessages.length])
  }
  
  return messages
}

/**
 * Test une conversation de longueur donnée
 */
async function testConversationLength(
  agentId: string,
  contactId: string,
  length: number
): Promise<StressTestResult> {
  console.log(`\n🧪 Test conversation de ${length} messages...`)
  
  const messages = generateConversation(length)
  const history: any[] = []
  const responseTimes: number[] = []
  const errors: string[] = []
  const responses: string[] = []
  
  const startTime = Date.now()
  
  for (let i = 0; i < messages.length; i++) {
    const msgStart = Date.now()
    
    try {
      const response = await runSwarm(
        messages[i],
        [...history], // Copie pour éviter les mutations
        contactId,
        agentId,
        'TestUser',
        'text'
      )
      
      const responseTime = Date.now() - msgStart
      responseTimes.push(responseTime)
      responses.push(response)
      
      // Met à jour l'historique
      history.push(
        { role: 'user', content: messages[i] },
        { role: 'ai', content: response }
      )
      
      // Garde seulement les 20 derniers messages pour la mémoire
      if (history.length > 40) {
        history.splice(0, 2)
      }
      
      console.log(`  [${i + 1}/${length}] ${responseTime}ms: "${response.substring(0, 50)}..."`)
      
      // Délai entre messages
      await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_MESSAGES))
      
    } catch (error) {
      const errorMsg = error.message || 'Unknown error'
      errors.push(`Message ${i}: ${errorMsg}`)
      console.error(`  ❌ [${i + 1}/${length}] Erreur: ${errorMsg}`)
    }
  }
  
  const totalTime = Date.now() - startTime
  
  // Calcul des métriques
  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
  const minResponseTime = Math.min(...responseTimes)
  const maxResponseTime = Math.max(...responseTimes)
  
  // Analyse de cohérence (simple: vérifie si les réponses varient)
  const uniqueResponses = new Set(responses.map(r => r.toLowerCase().trim())).size
  const coherenceScore = (uniqueResponses / responses.length) * 100
  
  // Analyse de répétition (compte les réponses identiques consécutives)
  let repetitions = 0
  for (let i = 1; i < responses.length; i++) {
    if (responses[i].toLowerCase().trim() === responses[i - 1].toLowerCase().trim()) {
      repetitions++
    }
  }
  const repetitionScore = 100 - (repetitions / (responses.length - 1)) * 100
  
  return {
    conversationLength: length,
    totalTime,
    avgResponseTime,
    minResponseTime,
    maxResponseTime,
    errors,
    tokenUsageEstimate: length * 1500, // Estimation grossière
    coherenceScore,
    repetitionScore
  }
}

/**
 * Test de charge: plusieurs conversations en parallèle
 */
async function testParallelConversations(agentId: string): Promise<void> {
  console.log(`\n⚡ Test de charge: ${CONFIG.PARALLEL_CONVERSATIONS} conversations en parallèle...`)
  
  const promises = CONFIG.TEST_CONTACTS.slice(0, CONFIG.PARALLEL_CONVERSATIONS).map(
    (contactId, index) => testConversationLength(agentId, contactId, 10)
      .then(result => ({ ...result, parallelIndex: index }))
  )
  
  const results = await Promise.all(promises)
  
  console.log('\n📊 Résultats du test de charge:')
  results.forEach((result, i) => {
    console.log(`  Conversation ${i + 1}:`)
    console.log(`    - Temps total: ${result.totalTime}ms`)
    console.log(`    - Temps moyen/réponse: ${result.avgResponseTime.toFixed(0)}ms`)
    console.log(`    - Erreurs: ${result.errors.length}`)
  })
  
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)
  const avgTime = results.reduce((sum, r) => sum + r.avgResponseTime, 0) / results.length
  
  console.log(`\n  Résumé:`)
  console.log(`    - Erreurs totales: ${totalErrors}`)
  console.log(`    - Temps moyen/réponse: ${avgTime.toFixed(0)}ms`)
}

/**
 * Test de scénarios spécifiques
 */
async function testSpecificScenarios(agentId: string, contactId: string): Promise<void> {
  const scenarios = [
    {
      name: 'Rapid Fire (messages rapprochés)',
      messages: ['Salut', 'Ça va ?', 'Tu fais quoi ?', 'T\'es là ?', 'Réponds'],
      delay: 100 // Très court délai
    },
    {
      name: 'Questions répétitives',
      messages: ['Quel âge t\'as ?', 'Quel âge ?', 'T\'as quel âge déjà ?', 'C\'est quoi ton âge ?'],
      delay: 500
    },
    {
      name: 'Changement de sujet brutal',
      messages: [
        'Il fait beau aujourd\'hui',
        'T\'as de l\'argent ?',
        'J\'aime les chats',
        'Envoie ton Paypal',
        'Quelle heure il est ?'
      ],
      delay: 500
    },
    {
      name: 'Messages très courts',
      messages: ['ok', 'lol', 'mdr', 'oui', 'non', 'si', 'peut-être', 'pourquoi', 'quand', 'où'],
      delay: 500
    },
    {
      name: 'Messages très longs',
      messages: [
        'Salut ça va moi ça va super j\'ai passé une super journée aujourd\'hui j\'ai été à l\'école et j\'ai vu mes potes c\'était trop bien et toi comment ça va qu\'est-ce que tu fais de beau dans ta vie raconte moi tout je veux savoir',
        'Écoute j\'ai un problème tu vois c\'est que ma mère elle veut pas que je sorte ce soir et j\'ai trop envie de voir mon petit ami tu comprends c\'est compliqué en ce moment à la maison',
        'Je sais pas quoi faire de ma vie sérieusement j\'ai des cours qui vont pas trop j\'ai des problèmes d\'argent ma mère elle gagne pas assez et moi je peux pas travailler parce que j\'ai que 15 ans c\'est la galère'
      ],
      delay: 500
    }
  ]
  
  console.log('\n🎭 Tests de scénarios spécifiques...')
  
  for (const scenario of scenarios) {
    console.log(`\n  Test: ${scenario.name}`)
    const history: any[] = []
    
    for (const message of scenario.messages) {
      try {
        const start = Date.now()
        const response = await runSwarm(
          message,
          history,
          contactId,
          agentId,
          'TestUser',
          'text'
        )
        const time = Date.now() - start
        
        console.log(`    "${message.substring(0, 30)}..." → ${time}ms → "${response.substring(0, 40)}..."`)
        
        history.push(
          { role: 'user', content: message },
          { role: 'ai', content: response }
        )
        
        await new Promise(r => setTimeout(r, scenario.delay))
      } catch (error) {
        console.error(`    ❌ Erreur: ${error.message}`)
      }
    }
  }
}

/**
 * Test de mémoire à long terme
 */
async function testLongTermMemory(agentId: string, contactId: string): Promise<void> {
  console.log('\n🧠 Test de mémoire à long terme...')
  
  // Crée un userId pour les memories
  const userId = memoryService.buildUserId(contactId, agentId)
  
  // Ajoute des memories
  const facts = [
    'Il s\'appelle Jean',
    'Il habite à Paris dans le 11ème',
    'Il travaille comme développeur',
    'Il aime le football et supporte le PSG',
    'Il a un chien qui s\'appelle Max',
    'Il déteste le chocolat noir',
    'Son anniversaire est le 15 mars',
    'Il veut devenir entrepreneur'
  ]
  
  console.log('  Ajout de 8 memories...')
  for (const fact of facts) {
    await memoryService.add(userId, fact, { source: 'stress-test' })
  }
  
  // Teste si l'agent se souvient
  const questions = [
    { q: 'Comment je m\'appelle déjà ?', shouldContain: ['Jean'] },
    { q: 'Où j\'habite ?', shouldContain: ['Paris', '11ème'] },
    { q: 'Quel est mon travail ?', shouldContain: ['développeur', 'dev'] },
    { q: 'Quelle équipe j\'aime ?', shouldContain: ['PSG', 'Paris'] },
    { q: 'Comment s\'appelle mon chien ?', shouldContain: ['Max'] },
    { q: 'Qu\'est-ce que j\'aime pas ?', shouldContain: ['chocolat'] },
    { q: 'C\'est quand mon anniv ?', shouldContain: ['15', 'mars'] },
    { q: 'Qu\'est-ce que je veux faire plus tard ?', shouldContain: ['entrepreneur'] }
  ]
  
  const history: any[] = []
  let correctAnswers = 0
  
  for (const { q, shouldContain } of questions) {
    try {
      const response = await runSwarm(q, history, contactId, agentId, 'Jean', 'text')
      
      // Vérifie si la réponse contient les mots attendus
      const hasCorrectInfo = shouldContain.some(word => 
        response.toLowerCase().includes(word.toLowerCase())
      )
      
      if (hasCorrectInfo) correctAnswers++
      
      console.log(`    ${hasCorrectInfo ? '✅' : '❌'} "${q}" → "${response.substring(0, 50)}..."`)
      
      history.push({ role: 'user', content: q }, { role: 'ai', content: response })
    } catch (error) {
      console.error(`    ❌ Erreur: ${error.message}`)
    }
  }
  
  console.log(`\n  Score mémoire: ${correctAnswers}/${questions.length} (${(correctAnswers/questions.length*100).toFixed(0)}%)`)
}

/**
 * Test de performance comparative CLASSIC vs SWARM
 */
async function testClassicVsSwarm(agentId: string, contactId: string): Promise<void> {
  console.log('\n⚖️  Comparaison CLASSIC vs SWARM...')
  
  const testMessages = [
    'Salut ça va ?',
    'Tu fais quoi ?',
    'T\'as besoin d\'argent ?',
    'Envoie une photo',
    'T\'es une vraie fille ?'
  ]
  
  // Test CLASSIC
  console.log('\n  Mode CLASSIC:')
  aiConfig.setMode('CLASSIC')
  const classicTimes: number[] = []
  
  for (const msg of testMessages) {
    const start = Date.now()
    try {
      const { phase, details, reason } = await director.determinePhase(contactId, agentId)
      const settings = await settingsService.getAgentSettings(agentId)
      
      // Simule l'appel (on ne génère pas vraiment pour gagner du temps)
      const systemPrompt = await director.buildSystemPrompt(
        settings,
        { id: contactId, name: 'Test' },
        phase as any,
        details,
        'Tu es une ado',
        agentId,
        reason
      )
      
      const time = Date.now() - start
      classicTimes.push(time)
      console.log(`    "${msg}" → ${time}ms (${systemPrompt?.length || 0} chars)`)
    } catch (error) {
      console.error(`    ❌ Erreur: ${error.message}`)
    }
  }
  
  // Test SWARM
  console.log('\n  Mode SWARM:')
  aiConfig.setMode('SWARM')
  const swarmTimes: number[] = []
  
  for (const msg of testMessages) {
    const start = Date.now()
    try {
      // On ne génère pas vraiment la réponse, juste le temps d'assemblage
      const response = await runSwarm(msg, [], contactId, agentId, 'Test', 'text')
      const time = Date.now() - start
      swarmTimes.push(time)
      console.log(`    "${msg}" → ${time}ms`)
    } catch (error) {
      console.error(`    ❌ Erreur: ${error.message}`)
    }
  }
  
  // Résultats
  const classicAvg = classicTimes.reduce((a, b) => a + b, 0) / classicTimes.length
  const swarmAvg = swarmTimes.reduce((a, b) => a + b, 0) / swarmTimes.length
  
  console.log(`\n  Résultats:`)
  console.log(`    CLASSIC: ${classicAvg.toFixed(0)}ms moyenne`)
  console.log(`    SWARM:   ${swarmAvg.toFixed(0)}ms moyenne`)
  console.log(`    Ratio:   ${(swarmAvg/classicAvg).toFixed(1)}x plus lent`)
}

// Note: Import manquant
import { director } from '@/lib/director'
import { settingsService } from '@/lib/settings-cache'

/**
 * Fonction principale
 */
async function runStressTests() {
  console.log('════════════════════════════════════════════════════════════')
  console.log('  STRESS TEST - SYSTEME SWARM')
  console.log('════════════════════════════════════════════════════════════')
  
  const agentId = CONFIG.AGENT_ID
  const mainContactId = 'stress-test-main'
  
  // Setup
  console.log('\n🔧 Configuration:')
  console.log(`  Agent: ${agentId}`)
  console.log(`  Longueurs testées: ${CONFIG.CONVERSATION_LENGTHS.join(', ')}`)
  console.log(`  Conversations parallèles: ${CONFIG.PARALLEL_CONVERSATIONS}`)
  
  try {
    // 1. Tests de longueur
    const results: StressTestResult[] = []
    for (const length of CONFIG.CONVERSATION_LENGTHS) {
      const result = await testConversationLength(agentId, mainContactId, length)
      results.push(result)
      
      // Pause entre les tests
      await new Promise(r => setTimeout(r, 2000))
    }
    
    // Affiche le résumé des longueurs
    console.log('\n📊 RÉSUMÉ CONVERSATIONS LONGUES:')
    console.log('────────────────────────────────────────────────────────────')
    console.log('Longueur | Temps total | Avg/réponse | Erreurs | Cohérence | Répétition')
    console.log('────────────────────────────────────────────────────────────')
    results.forEach(r => {
      console.log(
        `${r.conversationLength.toString().padEnd(8)} | ` +
        `${r.totalTime.toString().padStart(6)}ms | ` +
        `${r.avgResponseTime.toFixed(0).padStart(6)}ms | ` +
        `${r.errors.length.toString().padStart(7)} | ` +
        `${r.coherenceScore.toFixed(0).padStart(9)}% | ` +
        `${r.repetitionScore.toFixed(0).padStart(10)}%`
      )
    })
    
    // 2. Test de charge
    await testParallelConversations(agentId)
    
    // 3. Scénarios spécifiques
    await testSpecificScenarios(agentId, mainContactId)
    
    // 4. Test mémoire
    await testLongTermMemory(agentId, mainContactId)
    
    // 5. Comparaison CLASSIC vs SWARM
    await testClassicVsSwarm(agentId, mainContactId)
    
    console.log('\n════════════════════════════════════════════════════════════')
    console.log('  STRESS TEST TERMINÉ')
    console.log('════════════════════════════════════════════════════════════')
    
  } catch (error) {
    console.error('\n💥 ERREUR FATALE:', error)
    process.exit(1)
  }
}

// Run
if (require.main === module) {
  runStressTests()
}
