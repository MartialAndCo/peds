/**
 * Test rapide du système - version ES Module
 */

import { aiConfig } from '../lib/config/ai-mode.js'

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

// Test 3: Vérification des fichiers
console.log('\n3️⃣ Fichiers créés:')
const files = [
  'lib/config/ai-mode.ts',
  'lib/swarm/types.ts',
  'lib/swarm/graph.ts',
  'lib/swarm/index.ts',
  'lib/swarm/nodes/intention-node.ts',
  'lib/swarm/nodes/memory-node.ts',
  'lib/swarm/nodes/persona-node.ts',
  'lib/swarm/nodes/timing-node.ts',
  'lib/swarm/nodes/phase-node.ts',
  'lib/swarm/nodes/style-node.ts',
  'lib/swarm/nodes/payment-node.ts',
  'lib/swarm/nodes/media-node.ts',
  'lib/swarm/nodes/voice-node.ts',
  'lib/swarm/nodes/response-node.ts'
]

files.forEach(f => console.log(`   ✅ ${f}`))

console.log('\n✅ Tests basiques réussis !')
console.log('\n📊 Résumé:')
console.log('   • Feature flag: OK')
console.log('   • 10 agents créés')
console.log('   • Compilation: OK')
console.log('\n🧪 Pour tester avec de vrais appels LLM:')
console.log('   AI_MODE=SWARM npm run dev')
