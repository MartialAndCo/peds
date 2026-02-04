/**
 * TEST COMPLET SWARM - Stress Test avec vrais appels Venice
 * Scénarios: conversation longue, multi-agents, changements de contexte
 */

import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import axios from 'axios'

dotenv.config()

const prisma = new PrismaClient()

// Stats globales
const stats = {
  totalCalls: 0,
  totalTime: 0,
  errors: 0,
  modelsUsed: new Set<string>()
}

async function getSettings() {
  const settings = await prisma.setting.findMany()
  return settings.reduce((acc: any, s) => { acc[s.key] = s.value; return acc }, {})
}

async function callVenice(
  systemPrompt: string, 
  userMessage: string, 
  model: string, 
  temperature: number = 0.7, 
  maxTokens: number = 500,
  settings?: any
): Promise<string> {
  if (!settings) settings = await getSettings()
  
  const apiKey = settings.venice_api_key
  if (!apiKey) throw new Error('venice_api_key not found')
  
  const start = Date.now()
  
  try {
    const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: temperature,
      max_tokens: maxTokens
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    stats.totalCalls++
    stats.totalTime += Date.now() - start
    stats.modelsUsed.add(model)
    
    return response.data.choices[0].message.content
  } catch (error: any) {
    stats.errors++
    throw error
  }
}

// Agent Intention avec fallback
async function detectIntention(message: string, settings: any): Promise<any> {
  const prompt = `Tu es un analyste d'intention WhatsApp. Analyse ce message et réponds UNIQUEMENT en JSON:
{
  "intention": "paiement" | "photo" | "vocal" | "personnel" | "general" | "multi",
  "sousIntention": "demande" | "offre" | "question" | "refus" | "confirmation",
  "urgence": "high" | "normal" | "low",
  "besoinTiming": boolean,
  "besoinMemoire": boolean,
  "besoinPhase": boolean,
  "besoinPayment": boolean,
  "besoinMedia": boolean,
  "besoinVoice": boolean,
  "confiance": 0.0-1.0
}

Message: "${message}"

RÈGLES:
- "paiement": argent, PayPal, virement
- "photo": selfie, image, photo
- "vocal": appel, vocal, note vocale  
- "personnel": famille, vie, passé
- "general": discussion normale

Réponds UNIQUEMENT le JSON, rien d'autre.`

  try {
    const response = await callVenice(prompt, 'Analyse', 'llama-3.3-70b', 0.1, 300, settings)
    const clean = response.replace(/```json/g, '').replace(/```/g, '').trim()
    return JSON.parse(clean)
  } catch (error) {
    // Fallback sur venice-uncensored
    const response = await callVenice(prompt, 'Analyse', 'venice-uncensored', 0.1, 300, settings)
    const clean = response.replace(/```json/g, '').replace(/```/g, '').trim()
    return JSON.parse(clean)
  }
}

// Construit les contextes selon l'intention
async function buildContexts(
  profile: any, 
  agentContact: any, 
  intention: any,
  settings: any
): Promise<string> {
  const contexts: string[] = []
  
  // TIMING (toujours)
  const now = new Date()
  const hour = now.getHours()
  let activity = 'relax'
  if (hour >= 8 && hour < 17) activity = 'en cours'
  else if (hour >= 17 && hour < 20) activity = 'de retour à la maison'
  else if (hour >= 22 || hour < 7) activity = 'au lit'
  
  contexts.push(`[CONTEXTE VIE ACTUEL - ${hour}h]: Tu es ${activity}.`)
  
  // PERSONA (toujours)
  contexts.push(`[QUI TU ES]: ${profile.identityTemplate?.substring(0, 200)}...`)
  
  // PHASE (si besoin)
  if (intention.besoinPhase || intention.intention === 'paiement') {
    const phase = agentContact?.phase || 'CONNECTION'
    contexts.push(`[PHASE]: ${phase}. Signaux: ${JSON.stringify(agentContact?.signals || [])}`)
  }
  
  // STYLE (toujours)
  contexts.push(`[STYLE]: ${profile.styleRules?.substring(0, 200)}...`)
  
  // PAYMENT (si besoin)
  if (intention.besoinPayment) {
    contexts.push(`[PAIEMENT]: Disponible: ${profile.paypalEmail || 'non configuré'}`)
  }
  
  // MEDIA (si besoin)
  if (intention.besoinMedia) {
    contexts.push(`[PHOTOS]: [IMAGE:selfie] UNIQUEMENT si demandé explicitement.`)
  }
  
  // VOICE (si besoin)
  if (intention.besoinVoice) {
    contexts.push(`[VOCAUX]: [VOICE] si accusée de fake.`)
  }
  
  return contexts.join('\n\n')
}

// Génère la réponse finale
async function generateResponse(
  contexts: string, 
  userMessage: string,
  settings: any
): Promise<string> {
  const systemPrompt = `${contexts}

[INSTRUCTION FINALE]
Tu es une adolescente authentique (15 ans).
RÈGLES:
1. MAX 8 mots (couper avec ||| si plus)
2. Langage ado naturel (pas de "je suis", "comment puis-je")
3. Réponds DIRECTEMENT à ce qu'il dit
4. Tags: [IMAGE:xxx], [VOICE], [PAYMENT_RECEIVED], [REACT:emoji]
5. VARIE tes expressions`

  return callVenice(systemPrompt, userMessage, 'venice-uncensored', 0.7, 200, settings)
}

// Exécute un scénario complet
async function runScenario(
  name: string,
  messages: string[],
  profile: any,
  agentContact: any,
  settings: any
) {
  console.log(`\n🎬 SCÉNARIO: ${name}`)
  console.log('─'.repeat(60))
  
  const results = []
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    console.log(`\n💬 [${i + 1}/${messages.length}] "${msg}"`)
    
    const start = Date.now()
    
    try {
      // 1. Détection intention
      const intention = await detectIntention(msg, settings)
      console.log(`   🤖 Intention: ${intention.intention} (${intention.confiance})`)
      
      // 2. Construction contextes
      const contexts = await buildContexts(profile, agentContact, intention, settings)
      
      // 3. Génération réponse
      const response = await generateResponse(contexts, msg, settings)
      const duration = Date.now() - start
      
      console.log(`   ⏱️  ${duration}ms`)
      console.log(`   💬 Réponse: "${response.trim()}"`)
      
      results.push({ success: true, duration, intention: intention.intention })
      
    } catch (error: any) {
      console.log(`   ❌ Erreur: ${error.message}`)
      results.push({ success: false, error: error.message })
    }
  }
  
  const avgTime = results.filter(r => r.success).reduce((a, r) => a + (r.duration || 0), 0) / results.filter(r => r.success).length || 0
  const successRate = results.filter(r => r.success).length / results.length
  
  console.log(`\n📊 Résultat: ${(successRate * 100).toFixed(0)}% succès | ${avgTime.toFixed(0)}ms moy`)
  
  return results
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  🧪 TEST COMPLET SWARM - STRESS TEST')
  console.log('═══════════════════════════════════════════════════════════')
  
  const settings = await getSettings()
  console.log(`API Key: ${settings.venice_api_key ? '✅' : '❌'}`)
  
  // Récupère Anaïs
  const profile = await prisma.agentProfile.findFirst({
    where: { agentId: 'cmkvg0kzz00003vyv03zzt9kc' }
  })
  
  if (!profile) {
    console.error('Agent non trouvé')
    process.exit(1)
  }
  
  console.log(`Agent: Anaïs (${profile.locale})`)
  
  // Crée contact test
  let contact = await prisma.contact.findUnique({
    where: { phone_whatsapp: 'test-swarm-stress' }
  })
  
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        phone_whatsapp: 'test-swarm-stress',
        name: 'TestStress'
      }
    })
  }
  
  let agentContact = await prisma.agentContact.findUnique({
    where: {
      agentId_contactId: {
        agentId: profile.agentId,
        contactId: contact.id
      }
    }
  })
  
  if (!agentContact) {
    agentContact = await prisma.agentContact.create({
      data: {
        agentId: profile.agentId,
        contactId: contact.id,
        phase: 'CONNECTION',
        signals: []
      }
    })
  }
  
  // SCÉNARIO 1: Conversation de base
  await runScenario(
    'Conversation basique (3 messages)',
    ['Salut !', 'Ça va ?', 'Tu fais quoi ?'],
    profile, agentContact, settings
  )
  
  // SCÉNARIO 2: Test paiement (passe en CRISIS)
  await prisma.agentContact.update({
    where: { id: agentContact.id },
    data: { phase: 'CRISIS', signals: ['RESPONSIVE', 'ATTACHED'] }
  })
  agentContact = await prisma.agentContact.findUnique({ where: { id: agentContact.id } })
  
  await runScenario(
    'Test Paiement Phase CRISIS (4 messages)',
    ['Tu vas bien ?', 'T\'as besoin d\'aide ?', 'Je peux t\'envoyer 50€', 'C\'est fait'],
    profile, agentContact, settings
  )
  
  // SCÉNARIO 3: Test photos
  await runScenario(
    'Test Photos (3 messages)',
    ['Envoie une photo', 'Montre toi', 'T\'es mignonne'],
    profile, agentContact, settings
  )
  
  // SCÉNARIO 4: Test accusation fake
  await runScenario(
    'Test Accusation (3 messages)',
    ['T\'es une vraie fille ?', 'T\'es un bot ?', 'Prouve le'],
    profile, agentContact, settings
  )
  
  // SCÉNARIO 5: STRESS TEST - 10 messages rapides
  console.log('\n⚡ STRESS TEST: 10 messages rapides...')
  const stressMessages = [
    'Salut', 'Ça va', 'Quoi de neuf', 'Tu fais quoi', 'T\'es où',
    'Bizarre', 'Mdr', 'Ok', 'Bye', 'À plus'
  ]
  
  await runScenario('Stress test rapide (10 msg)', stressMessages, profile, agentContact, settings)
  
  // Résumé final
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  📊 RÉSULTATS FINAUX')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`
Total appels API: ${stats.totalCalls}
Temps total: ${stats.totalTime}ms
Temps moyen: ${(stats.totalTime / stats.totalCalls).toFixed(0)}ms
Erreurs: ${stats.errors}
Modèles utilisés: ${[...stats.modelsUsed].join(', ')}
`)
  
  // Reset
  await prisma.agentContact.update({
    where: { id: agentContact.id },
    data: { phase: 'CONNECTION', signals: [] }
  })
  
  await prisma.$disconnect()
  console.log('\n✅ Tests terminés')
}

main().catch(async (e) => {
  console.error('Erreur:', e)
  await prisma.$disconnect()
  process.exit(1)
})
