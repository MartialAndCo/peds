// Test du système de priorité paiement + réponse cohérente
import { prisma } from '../lib/prisma'
import { TimingManager } from '../lib/timing'

// Mock le code de chat.ts pour tester la détection
function testHighPriorityDetection(message: string): boolean {
  const moneyKeywords = ['money', 'pay', 'paypal', 'cashapp', 'venmo', 'zelle', 'transfer', 'cash', 'dollars', 'usd', '$', 'price', 'cost', 'bank', 'card', 'crypto', 'bitcoin', 'sent', 'paid', 'done', 'envoyé', 'payé', 'viré', 'transfered', 'just sent', 'sending']
  const lastContent = message.toLowerCase()
  return moneyKeywords.some(kw => lastContent.includes(kw))
}

// Test le payment-node du swarm
async function testPaymentNodeDetection(userMessage: string, agentId: string): Promise<string> {
  const profile = await prisma.agentProfile.findUnique({
    where: { agentId },
    select: { paymentRules: true, locale: true }
  })
  
  const isFrench = (profile?.locale || '').toLowerCase().startsWith('fr')
  
  // NOUVELLE logique du payment-node (plus permissive)
  const userMsg = userMessage.toLowerCase()
  
  const sentActionWords = ['sent', 'envoyé', 'envoye', 'payé', 'paye', 'paid', 'done', 
    'transfer', 'transferred', 'viré', 'vire', 'just sent', 'already sent', 
    "c'est fait", "cest fait", "check your", "regarde ton", "regardez"];
  
  const moneyContextWords = ['money', 'argent', 'payment', 'paiement', 'paypal', 
    'cashapp', 'venmo', 'zelle', 'transfer', 'virement', 'bank', 'compte',
    '$', '€', 'dollar', 'euro', 'bucks', '10k', '10 000', '10000', '10,000',
    'sent you', 'sent the', 'envoyé le', 'envoyé l'];
  
  const hasSentAction = sentActionWords.some(word => userMsg.includes(word));
  const hasMoneyContext = moneyContextWords.some(word => userMsg.includes(word));
  const isPaymentConfirmation = hasSentAction && (hasMoneyContext || userMsg.includes('check') || userMsg.includes('done'));
  
  if (isPaymentConfirmation) {
    return isFrench 
      ? '✅ DÉTECTÉ: Confirmation de paiement → Réponse rapide + remerciement'
      : '✅ DETECTED: Payment confirmation → Fast response + thank you'
  }
  
  return isFrench
    ? '❌ Non détecté comme confirmation'
    : '❌ Not detected as confirmation'
}

async function main() {
  console.log('🧪 TEST: Système de priorité paiement\n')
  console.log('='.repeat(60))
  
  // Test 1: High Priority Detection
  console.log('\n📋 TEST 1: Détection timing prioritaire')
  console.log('-'.repeat(40))
  
  const testMessages = [
    { msg: "no pb give me your paypal imma send you some money to feel better hurry up!", expected: true },
    { msg: "i just sent you 10K", expected: true },
    { msg: "payment done!", expected: true },
    { msg: "i transferred the money", expected: true },
    { msg: "c'est fait j'ai viré l'argent", expected: true },
    { msg: "envoyé 50€", expected: true },
    { msg: "how are you today?", expected: false },
    { msg: "what's your paypal?", expected: true }, // contains 'paypal'
  ]
  
  let passCount = 0
  for (const { msg, expected } of testMessages) {
    const result = testHighPriorityDetection(msg)
    const status = result === expected ? '✅' : '❌'
    if (result === expected) passCount++
    console.log(`${status} "${msg.substring(0, 40)}..." → ${result ? 'PRIORITAIRE' : 'normal'}`)
  }
  console.log(`\nScore: ${passCount}/${testMessages.length} tests passés`)
  
  // Test 2: Payment Confirmation Detection
  console.log('\n📋 TEST 2: Détection confirmation paiement (swarm)')
  console.log('-'.repeat(40))
  
  const confirmationTests = [
    { msg: "i just sent you 10K", expected: true },
    { msg: "sent 50 dollars", expected: true },
    { msg: "done, check your paypal", expected: true },
    { msg: "j'ai envoyé l'argent", expected: true },
    { msg: "what's up?", expected: false },
    { msg: "i will send money tomorrow", expected: false }, // futur, pas confirmation
  ]
  
  const agentId = 'cmkvfuyar00004uaximi0hhqw' // Lena
  passCount = 0
  
  for (const { msg, expected } of confirmationTests) {
    const result = await testPaymentNodeDetection(msg, agentId)
    const isDetected = result.includes('✅')
    const status = isDetected === expected ? '✅' : '❌'
    if (isDetected === expected) passCount++
    console.log(`${status} "${msg}"`)
    if (isDetected) console.log(`   → ${result}`)
  }
  console.log(`\nScore: ${passCount}/${confirmationTests.length} tests passés`)
  
  // Test 3: Vérification des règles DB
  console.log('\n📋 TEST 3: Contenu des règles en DB')
  console.log('-'.repeat(40))
  
  const profiles = await prisma.agentProfile.findMany({
    include: { agent: { select: { name: true } } }
  })
  
  for (const profile of profiles) {
    const rules = profile.paymentRules || ''
    const hasRule2 = rules.includes('ALREADY SENT') || rules.includes('DÉJÀ ENVOYÉ')
    const hasNoAskRule = rules.includes('NEVER say') || rules.includes('Ne DIS JAMAIS')
    const hasThankRule = rules.includes('THANK') || rules.includes('REMERCIE')
    
    console.log(`\n${profile.agent?.name || 'Agent'}:`)
    console.log(`  ${hasRule2 ? '✅' : '❌'} Règle "déjà envoyé" présente`)
    console.log(`  ${hasNoAskRule ? '✅' : '❌'} Interdiction de redemander présente`)
    console.log(`  ${hasThankRule ? '✅' : '❌'} Instruction de remercier présente`)
  }
  
  // Test 4: Simulation timing
  console.log('\n📋 TEST 4: Simulation timing')
  console.log('-'.repeat(40))
  
  const timing = TimingManager.analyzeContext(new Date(), 'MONEYPOT', true, 'Europe/Paris')
  console.log(`Mode prioritaire (isHighPriority=true):`)
  console.log(`  Mode: ${timing.mode}`)
  console.log(`  Délai: ${timing.delaySeconds}s (attendu: 10-30s)`)
  console.log(`  ${timing.delaySeconds >= 10 && timing.delaySeconds <= 30 ? '✅' : '❌'} Dans la plage attendue`)
  
  const timingNormal = TimingManager.analyzeContext(new Date(), 'MONEYPOT', false, 'Europe/Paris')
  console.log(`\nMode normal (isHighPriority=false):`)
  console.log(`  Mode: ${timingNormal.mode}`)
  console.log(`  Délai: ${timingNormal.delaySeconds}s`)
  
  console.log('\n' + '='.repeat(60))
  console.log('🏁 Tests terminés')
  
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
