/**
 * TEST STANDALONE - Utilise le vrai système Swarm sans serveur
 */

import { runSwarm } from '../lib/swarm/index'
import { prisma } from '../lib/prisma'
import { aiConfig } from '../lib/config/ai-mode'

// Force SWARM mode
aiConfig.setMode('SWARM')

function checkStyle(response: string): { valid: boolean; issues: string[] } {
  const issues: string[] = []
  
  if (response.includes(',')) issues.push('virgule')
  if (response.trim().endsWith('.')) issues.push('point final')
  
  // Check majuscule sauf si tag
  const trimmed = response.trim()
  if (trimmed.charAt(0) === trimmed.charAt(0).toUpperCase() && 
      trimmed.charAt(0).match(/[A-Z]/) && 
      !trimmed.startsWith('[')) {
    issues.push('majuscule début')
  }
  
  // Phrases interdites
  const forbidden = ['je suis', 'tu es', 'je ne', 'comment', 'pourquoi', 'parce que']
  for (const f of forbidden) {
    if (response.toLowerCase().includes(f)) {
      issues.push(`"${f}"`)
      break
    }
  }
  
  // Longueur
  const words = response.split(/\s+/).length
  if (words > 8 && !response.includes('|||')) {
    issues.push(`trop long (${words})`)
  }
  
  return { valid: issues.length === 0, issues }
}

async function main() {
  console.log('══════════════════════════════════════════════════════════════════')
  console.log('  🧪 TEST SWARM - SYSTÈME RÉEL (Standalone)')
  console.log('══════════════════════════════════════════════════════════════════')
  console.log(`Mode: ${aiConfig.mode}`)
  console.log('')
  
  try {
    // Récupère Anaïs
    const profile = await prisma.agentProfile.findFirst({
      where: { agentId: 'cmkvg0kzz00003vyv03zzt9kc' }
    })
    
    if (!profile) throw new Error('Agent not found')
    
    console.log(`Agent: ${profile.agentId} (${profile.locale})`)
    console.log(`Timezone: ${profile.timezone}`)
    console.log('')
    
    // Crée contact test
    const contact = await prisma.contact.create({
      data: {
        phone_whatsapp: `test-${Date.now()}`,
        name: 'TestStandalone'
      }
    })
    
    const agentContact = await prisma.agentContact.create({
      data: {
        agentId: profile.agentId,
        contactId: contact.id,
        phase: 'CONNECTION',
        signals: []
      }
    })
    
    console.log(`Contact créé: ${contact.id}`)
    console.log(`Phase: ${agentContact.phase}`)
    console.log('')
    
    const results: any[] = []
    const history: any[] = []
    
    // TEST 1: Messages basiques
    console.log('🎬 TEST 1: Conversation basique (CONNECTION)')
    console.log('─'.repeat(70))
    
    const messages1 = ['Salut', 'Ça va', 'Tu fais quoi', 'T\'es où']
    
    for (const msg of messages1) {
      process.stdout.write(`\n💬 "${msg}" → `)
      
      const start = Date.now()
      const response = await runSwarm(
        msg,
        history,
        contact.id,
        profile.agentId,
        'Test',
        'text'
      )
      const duration = Date.now() - start
      
      const style = checkStyle(response)
      const status = style.valid ? '✅' : '⚠️'
      
      console.log(`"${response}" [${duration}ms] ${status}`)
      if (!style.valid) console.log(`   Issues: ${style.issues.join(', ')}`)
      
      results.push({ phase: 'CONNECTION', msg, response, duration, style })
      
      history.push(
        { role: 'user', content: msg },
        { role: 'assistant', content: response }
      )
    }
    
    // Passe en CRISIS
    await prisma.agentContact.update({
      where: { id: agentContact.id },
      data: { phase: 'CRISIS', signals: ['ATTACHED'] }
    })
    
    console.log('\n\n🎬 TEST 2: Paiement (Phase CRISIS)')
    console.log('─'.repeat(70))
    
    const messages2 = [
      'T\'as besoin d\'argent ?',
      'Je peux t\'envoyer 50€',
      'C\'est fait'
    ]
    
    for (const msg of messages2) {
      process.stdout.write(`\n💬 "${msg}" → `)
      
      const start = Date.now()
      const response = await runSwarm(
        msg,
        history,
        contact.id,
        profile.agentId,
        'Test',
        'text'
      )
      const duration = Date.now() - start
      
      const style = checkStyle(response)
      const status = style.valid ? '✅' : '⚠️'
      
      console.log(`"${response}" [${duration}ms] ${status}`)
      if (!style.valid) console.log(`   Issues: ${style.issues.join(', ')}`)
      
      results.push({ phase: 'CRISIS', msg, response, duration, style })
      
      history.push(
        { role: 'user', content: msg },
        { role: 'assistant', content: response }
      )
    }
    
    // Stats
    const avgTime = results.reduce((a, r) => a + r.duration, 0) / results.length
    const styleOk = results.filter(r => r.style.valid).length
    
    console.log('\n\n══════════════════════════════════════════════════════════════════')
    console.log('  📊 RÉSULTATS')
    console.log('══════════════════════════════════════════════════════════════════')
    console.log(`Total: ${results.length} messages`)
    console.log(`Temps moyen: ${avgTime.toFixed(0)}ms`)
    console.log(`Style OK: ${styleOk}/${results.length}`)
    console.log('')
    
    // Résumé par phase
    const connectionResults = results.filter(r => r.phase === 'CONNECTION')
    const crisisResults = results.filter(r => r.phase === 'CRISIS')
    
    console.log(`CONNECTION: ${connectionResults.length} msg, ${connectionResults.filter(r => r.style.valid).length} style OK`)
    console.log(`CRISIS: ${crisisResults.length} msg, ${crisisResults.filter(r => r.style.valid).length} style OK`)
    
    // Cleanup
    await prisma.agentContact.delete({ where: { id: agentContact.id } })
    await prisma.contact.delete({ where: { id: contact.id } })
    
    console.log('\n✅ Tests terminés')
    await prisma.$disconnect()
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    await prisma.$disconnect()
    process.exit(1)
  }
}

main()
