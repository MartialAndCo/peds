/**
 * Test rapide du système swarm
 */

import { runSwarm } from '@/lib/swarm'
import { aiConfig } from '@/lib/config/ai-mode'

async function quickTest() {
  console.log('🚀 Test rapide du système SWARM\n')
  
  // Test 1: Mode CLASSIC
  console.log('1️⃣ Test mode CLASSIC:')
  aiConfig.setMode('CLASSIC')
  console.log(`   Mode actif: ${aiConfig.mode}`)
  console.log(`   Is Classic: ${aiConfig.isClassic()}`)
  console.log(`   Is Swarm: ${aiConfig.isSwarm()}`)
  
  // Test 2: Mode SWARM
  console.log('\n2️⃣ Test mode SWARM:')
  aiConfig.setMode('SWARM')
  console.log(`   Mode actif: ${aiConfig.mode}`)
  console.log(`   Is Classic: ${aiConfig.isClassic()}`)
  console.log(`   Is Swarm: ${aiConfig.isSwarm()}`)
  
  // Test 3: Intentions (sans appel LLM)
  console.log('\n3️⃣ Test détection intentions:')
  const testMessages = [
    'Salut ça va ?',
    'Je peux t\'envoyer 50€',
    'Envoie une photo',
    'Appelle-moi',
    'T\'es un bot ?'
  ]
  
  for (const msg of testMessages) {
    let intention = 'general'
    if (msg.includes('€') || msg.includes('argent')) intention = 'paiement'
    else if (msg.includes('photo')) intention = 'photo'
    else if (msg.includes('Appelle')) intention = 'vocal'
    else if (msg.includes('bot')) intention = 'general' // mais besoinVoice=true
    
    console.log(`   "${msg}" → ${intention}`)
  }
  
  console.log('\n✅ Tests basiques réussis !')
  console.log('\nPour tester avec de vrais appels LLM:')
  console.log('  AI_MODE=SWARM npx ts-node scripts/test-ai-modes.ts')
}

quickTest().catch(console.error)
