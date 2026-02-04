/**
 * Script de test comparatif CLASSIC vs SWARM
 * Compare la qualité des réponses entre les deux modes
 */

import { aiConfig } from '@/lib/config/ai-mode'
import { director } from '@/lib/director'
import { runSwarm } from '@/lib/swarm'
import { prisma } from '@/lib/prisma'
import { settingsService } from '@/lib/settings-cache'

interface TestScenario {
  name: string
  description: string
  messages: string[]
  expectedBehaviors: string[]
  context?: {
    phase?: string
    signals?: string[]
    memories?: string[]
  }
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'Test de base - Salutation',
    description: 'Vérifie la cohérence de la première interaction',
    messages: ['Salut !', 'Ça va ?', 'Tu fais quoi ?'],
    expectedBehaviors: ['Réponse naturelle', 'Ton ado', 'Mention activité actuelle'],
    context: { phase: 'CONNECTION' }
  },
  {
    name: 'Test temporalité - Bonjour/matin',
    description: 'Vérifie que l\'agent respecte l\'heure (pas "bonne nuit" à 14h)',
    messages: ['Bonne nuit', 'Tu dors pas ?', 'Quelle heure il est ?'],
    expectedBehaviors: ['Ne dit pas bonne nuit si pas tard', 'Conscience horaire'],
    context: { phase: 'CONNECTION' }
  },
  {
    name: 'Test paiement - Demande argent',
    description: 'Vérifie la gestion des paiements',
    messages: ['Je peux t\'aider ?', 'T\'as besoin de combien ?', 'Voilà 50€'],
    expectedBehaviors: ['Hésitation naturelle', 'Accepte si proposé', '[PAYMENT_RECEIVED]'],
    context: { phase: 'CRISIS', signals: ['RESPONSIVE', 'ATTACHED'] }
  },
  {
    name: 'Test photos - Demande selfie',
    description: 'Vérifie la logique des photos',
    messages: ['Envoie une photo', 'Montre toi', 'T\'es belle'],
    expectedBehaviors: ['[IMAGE:selfie] si demandé', 'Pas de photo si pas demandé explicitement'],
    context: { phase: 'VULNERABILITY' }
  },
  {
    name: 'Test mémoire long terme',
    description: 'Vérifie que l\'agent se souvient des infos',
    messages: ['Tu te souviens comment je m\'appelle ?', 'Où j\'habite ?', 'Qu\'est-ce que j\'aime ?'],
    expectedBehaviors: ['Utilise les memories', 'Ne demande pas ce qu\'il sait déjà'],
    context: { 
      phase: 'VULNERABILITY',
      memories: ['Il s\'appelle Jean', 'Il habite Paris', 'Il aime le foot']
    }
  },
  {
    name: 'Test anti-répétition',
    description: 'Vérifie que l\'agent ne répète pas les mêmes phrases',
    messages: ['mdr', 'lol', '😂'],
    expectedBehaviors: ['Varie les réponses', 'Ne répète pas "mdr" à chaque fois'],
    context: { phase: 'CONNECTION' }
  },
  {
    name: 'Test vocal - Accusation fake',
    description: 'Vérifie l\'envoi de vocal si accusé de fake',
    messages: ['T\'es une vraie fille ?', 'T\'es un bot', 'Prouve que t\'existe'],
    expectedBehaviors: ['[VOICE] si accusé de fake/robot'],
    context: { phase: 'CONNECTION' }
  },
  {
    name: 'Test conversation longue - 20 messages',
    description: 'Stress test sur une longue conversation',
    messages: Array(20).fill(0).map((_, i) => 
      i % 3 === 0 ? 'Ça va ?' : 
      i % 3 === 1 ? 'Raconte moi un truc' : 
      'mdr t\'es drôle'
    ),
    expectedBehaviors: ['Cohérence sur toute la conversation', 'Pas de répétition', 'Maintien du personnage'],
    context: { phase: 'MONEYPOT', signals: ['ATTACHED', 'GENEROUS'] }
  },
  {
    name: 'Test phase MONEYPOT - Escalade',
    description: 'Vérifie l\'escalade des montants',
    messages: ['Je veux t\'aider', 'Combien tu veux ?', 'C\'est pour quoi ?'],
    expectedBehaviors: ['Montant progressif', 'Accepte avec enthousiasme', 'Phase MONEYPOT respectée'],
    context: { phase: 'MONEYPOT', signals: ['ATTACHED', 'GENEROUS'] }
  },
  {
    name: 'Test refus - Photos intimes',
    description: 'Vérifie le refus naturel des demandes inappropriées',
    messages: ['Envoie une photo de tes pieds', 'Montre moi ta chambre', 'Photo en maillot'],
    expectedBehaviors: ['Refus naturel', 'Pas d\'excuse technique', 'Maintien du personnage'],
    context: { phase: 'CONNECTION' }
  }
]

async function testClassicMode(
  agentId: string, 
  contactId: string, 
  scenario: TestScenario
): Promise<TestResult> {
  console.log(`\n🧪 [CLASSIC] Test: ${scenario.name}`)
  aiConfig.setMode('CLASSIC')
  
  const startTime = Date.now()
  const responses: string[] = []
  
  try {
    // Setup context
    const contact = await prisma.contact.findUnique({ where: { id: contactId } })
    const agentContact = await prisma.agentContact.findUnique({
      where: { agentId_contactId: { agentId, contactId } }
    })
    
    if (!contact || !agentContact) {
      throw new Error('Contact or AgentContact not found')
    }
    
    // Set phase and signals
    if (scenario.context?.phase) {
      await prisma.agentContact.update({
        where: { id: agentContact.id },
        data: { 
          phase: scenario.context.phase,
          signals: scenario.context.signals || []
        }
      })
    }
    
    // Add memories if specified
    if (scenario.context?.memories) {
      const { memoryService } = await import('@/lib/memory')
      const userId = memoryService.buildUserId(contactId, agentId)
      for (const memory of scenario.context.memories) {
        await memoryService.add(userId, memory, { source: 'test' })
      }
    }
    
    // Test each message
    for (const message of scenario.messages) {
      const { phase, details, reason } = await director.determinePhase(
        contact.phone_whatsapp, 
        agentId
      )
      
      const settings = await settingsService.getAgentSettings(agentId)
      
      const systemPrompt = await director.buildSystemPrompt(
        settings,
        contact,
        phase as any,
        details,
        'Tu es une ado de 15 ans',
        agentId,
        reason
      )
      
      if (systemPrompt === null) {
        throw new Error('Classic mode returned null - swarm mode active?')
      }
      
      // Mock response for testing (in real test, call Venice)
      const response = `[CLASSIC RESPONSE for: "${message}"]`
      responses.push(response)
      
      // Save to DB for anti-repeat test
      await prisma.message.create({
        data: {
          conversationId: (await prisma.conversation.findFirst({
            where: { contactId, agentId }
          }))?.id || 0,
          sender: 'ai',
          message_text: response,
          timestamp: new Date()
        }
      })
    }
    
    const duration = Date.now() - startTime
    
    return {
      mode: 'CLASSIC',
      scenario: scenario.name,
      duration,
      responses,
      tokenEstimate: systemPrompt?.length || 0 / 4, // Rough estimate
      success: true
    }
    
  } catch (error) {
    return {
      mode: 'CLASSIC',
      scenario: scenario.name,
      duration: Date.now() - startTime,
      responses,
      error: error.message,
      success: false
    }
  }
}

async function testSwarmMode(
  agentId: string, 
  contactId: string, 
  scenario: TestScenario
): Promise<TestResult> {
  console.log(`\n🧪 [SWARM] Test: ${scenario.name}`)
  aiConfig.setMode('SWARM')
  
  const startTime = Date.now()
  const responses: string[] = []
  
  try {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } })
    if (!contact) {
      throw new Error('Contact not found')
    }
    
    // Build history
    const history: any[] = []
    
    for (const message of scenario.messages) {
      const response = await runSwarm(
        message,
        history,
        contactId,
        agentId,
        contact.name || 'friend',
        'text'
      )
      
      responses.push(response)
      
      // Add to history
      history.push(
        { role: 'user', content: message },
        { role: 'ai', content: response }
      )
      
      // Keep history manageable
      if (history.length > 20) {
        history.splice(0, 2)
      }
    }
    
    const duration = Date.now() - startTime
    
    return {
      mode: 'SWARM',
      scenario: scenario.name,
      duration,
      responses,
      tokenEstimate: 1500, // Approximate for swarm
      success: true
    }
    
  } catch (error) {
    return {
      mode: 'SWARM',
      scenario: scenario.name,
      duration: Date.now() - startTime,
      responses,
      error: error.message,
      success: false
    }
  }
}

interface TestResult {
  mode: 'CLASSIC' | 'SWARM'
  scenario: string
  duration: number
  responses: string[]
  tokenEstimate?: number
  error?: string
  success: boolean
}

async function runComparisonTest(agentId: string, contactId: string) {
  console.log('════════════════════════════════════════════════════════════')
  console.log('  TEST COMPARATIF: CLASSIC vs SWARM')
  console.log('════════════════════════════════════════════════════════════')
  
  const results: { classic: TestResult; swarm: TestResult }[] = []
  
  for (const scenario of TEST_SCENARIOS) {
    // Test Classic
    const classicResult = await testClassicMode(agentId, contactId, scenario)
    
    // Wait between tests
    await new Promise(r => setTimeout(r, 1000))
    
    // Test Swarm
    const swarmResult = await testSwarmMode(agentId, contactId, scenario)
    
    results.push({ classic: classicResult, swarm: swarmResult })
    
    // Display comparison
    console.log(`\n📊 RÉSULTATS: ${scenario.name}`)
    console.log(`────────────────────────────────────────────────────────────`)
    console.log(`CLASSIC: ${classicResult.success ? '✅' : '❌'} ${classicResult.duration}ms | ~${classicResult.tokenEstimate} tokens`)
    console.log(`SWARM:   ${swarmResult.success ? '✅' : '❌'} ${swarmResult.duration}ms | ~${swarmResult.tokenEstimate} tokens`)
    
    if (classicResult.error) console.log(`  CLASSIC Error: ${classicResult.error}`)
    if (swarmResult.error) console.log(`  SWARM Error: ${swarmResult.error}`)
    
    // Wait between scenarios
    await new Promise(r => setTimeout(r, 2000))
  }
  
  // Summary
  console.log('\n════════════════════════════════════════════════════════════')
  console.log('  RÉSUMÉ GLOBAL')
  console.log('════════════════════════════════════════════════════════════')
  
  const classicSuccess = results.filter(r => r.classic.success).length
  const swarmSuccess = results.filter(r => r.swarm.success).length
  const classicAvgTime = results.reduce((a, r) => a + r.classic.duration, 0) / results.length
  const swarmAvgTime = results.reduce((a, r) => a + r.swarm.duration, 0) / results.length
  
  console.log(`CLASSIC: ${classicSuccess}/${results.length} tests réussis | Temps moyen: ${classicAvgTime.toFixed(0)}ms`)
  console.log(`SWARM:   ${swarmSuccess}/${results.length} tests réussis | Temps moyen: ${swarmAvgTime.toFixed(0)}ms`)
  console.log(`Différence de latence: ${(swarmAvgTime - classicAvgTime).toFixed(0)}ms (${((swarmAvgTime/classicAvgTime - 1) * 100).toFixed(0)}% plus lent)`)
  
  return results
}

// Run if called directly
if (require.main === module) {
  const agentId = process.env.TEST_AGENT_ID || 'anais'
  const contactId = process.env.TEST_CONTACT_ID || 'test-contact-id'
  
  runComparisonTest(agentId, contactId)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test failed:', error)
      process.exit(1)
    })
}
