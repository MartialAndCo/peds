/**
 * TEST D'INTÉGRATION RÉEL - Utilise le vrai système Swarm
 * Les agents vont chercher les vraies données en DB
 */

import { runSwarm } from '@/lib/swarm'
import { prisma } from '@/lib/prisma'
import { aiConfig } from '@/lib/config/ai-mode'
import { settingsService } from '@/lib/settings-cache'

// Force le mode SWARM
aiConfig.setMode('SWARM')

const CONFIG = {
  AGENT_ID: 'cmkvg0kzz00003vyv03zzt9kc',
  TEST_CONTACT_PHONE: 'test-swarm-integration'
}

interface TestResult {
  message: string
  intention?: string
  response: string
  duration: number
  success: boolean
  error?: string
  contexts?: any
}

function checkStyle(response: string): { valid: boolean; issues: string[] } {
  const issues: string[] = []
  
  if (response.includes(',')) issues.push('virgule')
  if (response.trim().endsWith('.')) issues.push('point final')
  if (response.match(/^[A-Z]/)) issues.push('majuscule début')
  
  const longWords = ['je suis', 'tu es', 'je ne', 'comment', 'pourquoi', 'parce que']
  for (const w of longWords) {
    if (response.toLowerCase().includes(w)) {
      issues.push(`phrase complète "${w}"`)
      break
    }
  }
  
  const words = response.split(/\s+/).length
  if (words > 8 && !response.includes('|||')) issues.push(`trop long (${words} mots)`)
  
  return { valid: issues.length === 0, issues }
}

async function setupTestContact() {
  let contact = await prisma.contact.findUnique({
    where: { phone_whatsapp: CONFIG.TEST_CONTACT_PHONE }
  })
  
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        phone_whatsapp: CONFIG.TEST_CONTACT_PHONE,
        name: 'TestIntegration'
      }
    })
  }
  
  let agentContact = await prisma.agentContact.findUnique({
    where: {
      agentId_contactId: { agentId: CONFIG.AGENT_ID, contactId: contact.id }
    }
  })
  
  if (!agentContact) {
    agentContact = await prisma.agentContact.create({
      data: {
        agentId: CONFIG.AGENT_ID,
        contactId: contact.id,
        phase: 'CONNECTION',
        signals: []
      }
    })
  }
  
  return { contact, agentContact }
}

async function runTestScenario(
  name: string,
  messages: string[],
  contactId: string,
  agentId: string
) {
  console.log(`\n🎬 ${name}`)
  console.log('─'.repeat(70))
  
  const results: TestResult[] = []
  const history: any[] = []
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    console.log(`\n💬 [${i + 1}/${messages.length}] "${msg}"`)
    
    const start = Date.now()
    
    try {
      // APPEL AU VRAI SYSTÈME SWARM
      const response = await runSwarm(
        msg,
        history,
        contactId,
        agentId,
        'TestUser',
        'text'
      )
      
      const duration = Date.now() - start
      const styleCheck = checkStyle(response)
      
      console.log(`   ⏱️  ${duration}ms`)
      console.log(`   💬 "${response}"`)
      
      if (styleCheck.valid) {
        console.log(`   ✅ Style OK`)
      } else {
        console.log(`   ⚠️  ${styleCheck.issues.join(', ')}`)
      }
      
      results.push({
        message: msg,
        response,
        duration,
        success: true
      })
      
      history.push(
        { role: 'user', content: msg },
        { role: 'assistant', content: response }
      )
      
      // Garde seulement les 10 derniers messages
      if (history.length > 20) {
        history.splice(0, 2)
      }
      
    } catch (error: any) {
      console.log(`   ❌ Erreur: ${error.message}`)
      results.push({
        message: msg,
        response: '',
        duration: Date.now() - start,
        error: error.message,
        success: false
      })
    }
  }
  
  // Stats
  const successCount = results.filter(r => r.success).length
  const styleOkCount = results.filter(r => r.success && checkStyle(r.response).valid).length
  const avgTime = results.filter(r => r.success).reduce((a, r) => a + r.duration, 0) / successCount || 0
  
  console.log(`\n📊 ${successCount}/${results.length} OK | ${styleOkCount}/${successCount} style OK | ${avgTime.toFixed(0)}ms moy`)
  
  return results
}

async function main() {
  console.log('══════════════════════════════════════════════════════════════════')
  console.log('  🧪 TEST INTÉGRATION - VRAI SYSTÈME SWARM')
  console.log('══════════════════════════════════════════════════════════════════')
  console.log('Mode: SWARM (les agents vont chercher les vraies données en DB)')
  console.log('')
  
  // Setup
  const { contact, agentContact } = await setupTestContact()
  console.log(`Contact: ${contact.name} (ID: ${contact.id})`)
  console.log(`Phase initiale: ${agentContact.phase}`)
  console.log(`Mode AI: ${aiConfig.mode}`)
  console.log('')
  
  // SCÉNARIO 1: Basique
  await runTestScenario(
    'SCÉNARIO 1: Conversation basique',
    ['Salut', 'Ça va', 'Tu fais quoi', 'T\'es où'],
    contact.id,
    CONFIG.AGENT_ID
  )
  
  // Passe en CRISIS
  await prisma.agentContact.update({
    where: { id: agentContact.id },
    data: { phase: 'CRISIS', signals: ['ATTACHED', 'RESPONSIVE'] }
  })
  
  // SCÉNARIO 2: Paiement
  await runTestScenario(
    'SCÉNARIO 2: Paiement (Phase CRISIS)',
    [
      'T\'as besoin d\'aide ?',
      'Je peux t\'envoyer 50 balles',
      'C\'est fait',
      'T\'as reçu ?'
    ],
    contact.id,
    CONFIG.AGENT_ID
  )
  
  // Passe en MONEYPOT
  await prisma.agentContact.update({
    where: { id: agentContact.id },
    data: { phase: 'MONEYPOT', signals: ['ATTACHED', 'GENEROUS', 'INTERESTED'] }
  })
  
  // SCÉNARIO 3: Photos + Relations
  await runTestScenario(
    'SCÉNARIO 3: Photos et relation',
    [
      'Envoie moi une photo',
      'T\'es belle',
      'Je t\'aime bien',
      'On se voit quand ?'
    ],
    contact.id,
    CONFIG.AGENT_ID
  )
  
  // SCÉNARIO 4: Stress test (10 messages rapides)
  console.log('\n⚡ SCÉNARIO 4: Stress test (10 messages)')
  const stressMessages = [
    'Salut', 'Ça va', 'Quoi de neuf', 'Tu fais quoi', 'T\'es où',
    'Mdr', 'Trop drôle', 'Ok', 'Bye', 'À plus'
  ]
  
  const startStress = Date.now()
  await runTestScenario('Stress test rapide', stressMessages, contact.id, CONFIG.AGENT_ID)
  const stressDuration = Date.now() - startStress
  
  console.log(`\n⏱️  Temps total stress test: ${stressDuration}ms (${(stressDuration/10).toFixed(0)}ms/msg)`)
  
  // Résumé
  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log('  ✅ TESTS TERMINÉS')
  console.log('══════════════════════════════════════════════════════════════════')
  
  // Reset
  await prisma.agentContact.update({
    where: { id: agentContact.id },
    data: { phase: 'CONNECTION', signals: [] }
  })
  
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('Erreur:', e)
  await prisma.$disconnect()
  process.exit(1)
})
