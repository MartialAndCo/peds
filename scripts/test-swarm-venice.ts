/**
 * TEST RÉEL AVEC APPELS VENICE
 */

import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import axios from 'axios'

dotenv.config()

const prisma = new PrismaClient()

const CONFIG = {
  INTENTION_MODEL: 'llama-3.3-70b',
  AGENT_ID: 'cmkvg0kzz00003vyv03zzt9kc',
  TEST_CONTACT_PHONE: 'test-swarm-contact'
}

// Recupere les settings depuis la DB
async function getSettings() {
  const settings = await prisma.setting.findMany()
  const settingsMap = settings.reduce((acc: any, s) => {
    acc[s.key] = s.value
    return acc
  }, {})
  
  // Recupere aussi les agent settings
  const agentSettings = await prisma.agentSetting.findMany({
    where: { agentId: CONFIG.AGENT_ID }
  })
  
  for (const s of agentSettings) {
    settingsMap[s.key] = s.value
  }
  
  return settingsMap
}

let globalSettings: any = null

async function callVenice(systemPrompt: string, userMessage: string, model: string, temperature: number = 0.7, maxTokens: number = 500): Promise<string> {
  if (!globalSettings) {
    globalSettings = await getSettings()
  }
  
  const apiKey = globalSettings.venice_api_key
  if (!apiKey) {
    throw new Error('venice_api_key not found in settings')
  }
  
  const body = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: temperature,
    max_tokens: maxTokens
  }
  
  console.log('   → Sending model:', model)
  
  const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', body, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })

  return response.data.choices[0].message.content
}

async function main() {
  console.log('TEST SWARM AVEC VRAIS APPELS VENICE')
  console.log('====================================')
  
  // Charge les settings
  globalSettings = await getSettings()
  console.log(`API Key trouvee: ${globalSettings.venice_api_key ? 'Oui' : 'Non'}`)
  console.log(`Modele: ${globalSettings.venice_model || 'venice-uncensored'}`)

  const profile = await prisma.agentProfile.findUnique({
    where: { agentId: CONFIG.AGENT_ID }
  })

  if (!profile) {
    console.error('Agent non trouve')
    process.exit(1)
  }

  // Force l'utilisation de llama-3.3-70b qui fonctionne
  const MODEL = 'llama-3.3-70b'
  
  console.log(`Agent: Anaïs (${profile.locale})`)
  console.log(`Model: llama-3.3-70b`)

  // Test 1: Detection intention
  console.log('\n--- TEST 1: Detection intention ---')
  
  const intentionPrompt = `Tu es un analyste d'intention. Analyse ce message et reponds UNIQUEMENT en JSON:
{
  "intention": "general",
  "besoinTiming": true,
  "besoinPayment": false,
  "confiance": 0.8
}

Message: "Je peux t'envoyer 50 euros"`

  try {
    console.log('Trying llama-3.3-70b...')
    const start = Date.now()
    const response = await callVenice(intentionPrompt, 'Analyse', CONFIG.INTENTION_MODEL, 0.1, 200)
    console.log(`Success in ${Date.now() - start}ms: ${response.substring(0, 100)}`)
  } catch (error: any) {
    console.log(`llama failed: ${error.message}`)
    console.log('Trying venice-uncensored...')
    const start = Date.now()
    const response = await callVenice(intentionPrompt, 'Analyse', 'venice-uncensored', 0.1, 200)
    console.log(`Success in ${Date.now() - start}ms: ${response.substring(0, 100)}`)
  }

  // Test 2: Generation reponse
  console.log('\n--- TEST 2: Generation reponse ---')
  
  const systemPrompt = `Tu es Anaïs, 15 ans. Tu es en cours de maths.
Regles:
- MAX 8 mots
- Langage ado naturel
- Reponds directement`

  const start = Date.now()
  const response = await callVenice(systemPrompt, 'Ça va ? Tu fais quoi ?', 'venice-uncensored', 0.7, 100)
  console.log(`Response in ${Date.now() - start}ms: "${response}"`)

  // Test 3: Paiement
  console.log('\n--- TEST 3: Detection paiement ---')
  
  const paymentPrompt = `Analyse ce message. Reponds JSON avec intention "paiement" si c'est une offre d'argent.

Message: "Je peux t'aider financierement, tu as besoin de combien ?"`

  const resp = await callVenice(paymentPrompt, 'Analyse', CONFIG.INTENTION_MODEL, 0.1, 200)
  console.log(`Result: ${resp}`)

  console.log('\n✅ Tests termines')
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error('Erreur:', error)
  await prisma.$disconnect()
  process.exit(1)
})
