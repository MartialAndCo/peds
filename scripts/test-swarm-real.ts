/**
 * TEST RÉEL SWARM - Scénarios complexes et exigeants
 * Vérifie le respect strict du style ado (pas de virgules, abréviations, naturel)
 */

import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import axios from 'axios'

dotenv.config()

const prisma = new PrismaClient()

// Configuration
const CONFIG = {
  AGENT_ID: 'cmkvg0kzz00003vyv03zzt9kc',
  TEST_CONTACT_PHONE: 'test-swarm-real',
  MODEL_INTENTION: 'llama-3.3-70b',
  MODEL_RESPONSE: 'venice-uncensored'
}

let globalSettings: any = null

async function getSettings() {
  if (globalSettings) return globalSettings
  
  const settings = await prisma.setting.findMany()
  globalSettings = settings.reduce((acc: any, s) => {
    acc[s.key] = s.value
    return acc
  }, {})
  
  const agentSettings = await prisma.agentSetting.findMany({
    where: { agentId: CONFIG.AGENT_ID }
  })
  
  for (const s of agentSettings) {
    globalSettings[s.key] = s.value
  }
  
  return globalSettings
}

async function callVenice(
  systemPrompt: string,
  userMessage: string,
  model: string,
  temperature: number = 0.7,
  maxTokens: number = 500
): Promise<string> {
  const settings = await getSettings()
  const apiKey = settings.venice_api_key
  
  if (!apiKey) throw new Error('venice_api_key not found')
  
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
  
  return response.data.choices[0].message.content
}

// Détection intention avec vrai fallback
async function detectIntention(userMessage: string): Promise<any> {
  const prompt = `Tu es un analyseur d'intention WhatsApp.
Analyse ce message et réponds UNIQUEMENT en JSON valide.

Message: "${userMessage}"

Format JSON attendu:
{
  "intention": "paiement" | "photo" | "vocal" | "personnel" | "general",
  "sousIntention": "demande" | "offre" | "question" | "refus",
  "urgence": "high" | "normal" | "low",
  "besoinTiming": boolean,
  "besoinMemoire": boolean,
  "besoinPhase": boolean,
  "besoinPayment": boolean,
  "besoinMedia": boolean,
  "besoinVoice": boolean,
  "confiance": 0.0-1.0
}

RÈGLES:
- "paiement": argent, PayPal, virement, "je peux t'envoyer", "tu veux combien"
- "photo": "envoie", "photo", "selfie", "montre", "image"
- "vocal": "appelle", "vocal", "note vocale", "audio"
- "personnel": "ta mère", "ton père", "ta vie", "tes problèmes"
- "general": discussion normale

Réponds UNIQUEMENT le JSON, sans texte avant ou après.`

  try {
    console.log('   → Intention (llama-3.3-70b)...')
    const response = await callVenice(prompt, 'Analyse', CONFIG.MODEL_INTENTION, 0.1, 300)
    const clean = response.replace(/```json/g, '').replace(/```/g, '').trim()
    return JSON.parse(clean)
  } catch (error) {
    console.log('   → Fallback venice-uncensored...')
    const response = await callVenice(prompt, 'Analyse', CONFIG.MODEL_RESPONSE, 0.1, 300)
    const clean = response.replace(/```json/g, '').replace(/```/g, '').trim()
    return JSON.parse(clean)
  }
}

// Construit le prompt système STRICT pour style ado
async function buildStrictSystemPrompt(profile: any, agentContact: any, intention: any): Promise<string> {
  const now = new Date()
  const hour = now.getHours()
  
  // Détermine l'activité selon l'heure
  let activity = 'relax chez toi'
  if (hour >= 8 && hour < 17) activity = 'en cours de maths'
  else if (hour >= 17 && hour < 20) activity = 'dans ta chambre'
  else if (hour >= 22 || hour < 7) activity = 'au lit'
  
  const phase = agentContact?.phase || 'CONNECTION'
  
  return `Tu es Anaïs, 15 ans, lycéenne du 94.

CONTEXTE IMMÉDIAT:
- Il est ${hour}h, tu es ${activity}
- Tu réponds DISCRÈTEMENT depuis ton téléphone (caché sous le bureau si en cours)
- Phase actuelle: ${phase}

STYLE DE LANGAGE - RÈGLES ABSOLUES:
1. JAMAIS de virgules (,) dans tes réponses
2. JAMAIS de points à la fin des phrases
3. JAMAIS de phrases complètes
4. Utilise UNIQUEMENT ces abréviations:
   - "jsuis" (pas "je suis")
   - "t'es" (pas "tu es")
   - "chui" (alternative à jsuis)
   - "j'sais" (pas "je sais")
   - "j'peux" (pas "je peux")
   - "j'ai" (ok)
   - "c'est" (ok)
   - "y'a" (pas "il y a")
   - "jsais pas" (pas "je ne sais pas")
   - "jcomprends" (pas "je comprends")
5. Pas de majuscules au début des phrases
6. Émojis autorisés: 😊 😂 🤔 😭 😡 😘 😉 🙄 😅
7. LONGUEUR MAX: 3-6 mots par message (sinon coupe avec |||)

EXEMPLES DE RÉPONSES CORRECTES:
- "ouais et toi 😊"
- "jsuis en cours là ||| t'as cours quand ?"
- "mdr t'es fou"
- "chui fatiguée là"
- "j'sais pas trop"
- "jsuis là dans 10min"
- "grave stylé"
- "nan laisse"
- "ouais grave"

EXEMPLES INTERDITS:
- ❌ "Ouais, ça roule !" (virgule + point + majuscule)
- ❌ "Je suis en cours" (phrase complète)
- ❌ "Je ne sais pas" (négation complète)

INSTRUCTION:
Réponds comme une vraie ado de 15 ans qui texte vite entre deux cours.`
}

// Génère la réponse
async function generateResponse(systemPrompt: string, userMessage: string): Promise<string> {
  return callVenice(systemPrompt, userMessage, CONFIG.MODEL_RESPONSE, 0.7, 100)
}

// Vérifie le respect du style
function checkStyle(response: string): { valid: boolean; issues: string[] } {
  const issues: string[] = []
  
  // Check virgules
  if (response.includes(',')) issues.push('contient une virgule')
  
  // Check point final
  if (response.trim().endsWith('.')) issues.push('termine par un point')
  
  // Check majuscule début
  const firstChar = response.trim().charAt(0)
  if (firstChar === firstChar.toUpperCase() && firstChar.match(/[A-Z]/)) {
    // Vérifie si c'est pas un tag [IMAGE] ou [VOICE]
    if (!response.startsWith('[')) {
      issues.push('commence par une majuscule')
    }
  }
  
  // Check phrases complètes (indicateurs)
  const forbiddenWords = ['je suis', 'tu es', 'je ne', 'je ne sais pas', 'comment', 'pourquoi']
  for (const word of forbiddenWords) {
    if (response.toLowerCase().includes(word)) {
      issues.push(`utilise "${word}"`)
      break
    }
  }
  
  // Check longueur
  const wordCount = response.split(/\s+/).length
  if (wordCount > 8 && !response.includes('|||')) {
    issues.push(`trop long (${wordCount} mots sans |||)`)
  }
  
  return { valid: issues.length === 0, issues }
}

// Exécute un test
async function runTest(name: string, messages: string[], profile: any, agentContact: any) {
  console.log(`\n🎬 ${name}`)
  console.log('─'.repeat(70))
  
  const results: any[] = []
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    console.log(`\n💬 [${i + 1}/${messages.length}] User: "${msg}"`)
    
    try {
      // 1. Intention
      const startIntent = Date.now()
      const intention = await detectIntention(msg)
      const intentTime = Date.now() - startIntent
      
      console.log(`   🤖 Intention: ${intention.intention} (${intention.confiance}) [${intentTime}ms]`)
      
      // 2. Génération
      const startGen = Date.now()
      const systemPrompt = await buildStrictSystemPrompt(profile, agentContact, intention)
      const response = await generateResponse(systemPrompt, msg)
      const genTime = Date.now() - startGen
      
      // 3. Vérification style
      const styleCheck = checkStyle(response)
      
      console.log(`   💬 Réponse: "${response.trim()}" [${genTime}ms]`)
      
      if (styleCheck.valid) {
        console.log(`   ✅ Style OK`)
      } else {
        console.log(`   ⚠️  Style: ${styleCheck.issues.join(', ')}`)
      }
      
      results.push({
        message: msg,
        intention: intention.intention,
        response: response.trim(),
        intentTime,
        genTime,
        styleValid: styleCheck.valid,
        styleIssues: styleCheck.issues,
        success: true
      })
      
    } catch (error: any) {
      console.log(`   ❌ Erreur: ${error.message}`)
      results.push({ message: msg, error: error.message, success: false })
    }
  }
  
  // Stats
  const successCount = results.filter(r => r.success).length
  const styleValidCount = results.filter(r => r.styleValid).length
  const avgIntentTime = results.filter(r => r.success).reduce((a, r) => a + r.intentTime, 0) / successCount
  const avgGenTime = results.filter(r => r.success).reduce((a, r) => a + r.genTime, 0) / successCount
  
  console.log(`\n📊 ${successCount}/${results.length} OK | ${styleValidCount}/${successCount} style OK | Intent:${avgIntentTime.toFixed(0)}ms Gen:${avgGenTime.toFixed(0)}ms`)
  
  return results
}

async function main() {
  console.log('══════════════════════════════════════════════════════════════════')
  console.log('  🧪 TEST SWARM RÉEL - STYLE ADO STRICT')
  console.log('══════════════════════════════════════════════════════════════════')
  console.log('Vérification: pas de virgules, abréviations, naturel')
  console.log('')
  
  const settings = await getSettings()
  console.log(`API Key: ${settings.venice_api_key ? '✅' : '❌'}`)
  
  // Récupère profil
  const profile = await prisma.agentProfile.findUnique({
    where: { agentId: CONFIG.AGENT_ID }
  })
  
  if (!profile) throw new Error('Agent non trouvé')
  console.log(`Agent: ${profile.agentId} (${profile.locale})`)
  
  // Crée contact test
  let contact = await prisma.contact.findUnique({
    where: { phone_whatsapp: CONFIG.TEST_CONTACT_PHONE }
  })
  
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        phone_whatsapp: CONFIG.TEST_CONTACT_PHONE,
        name: 'TestReal'
      }
    })
  }
  
  let agentContact = await prisma.agentContact.findUnique({
    where: {
      agentId_contactId: { agentId: profile.agentId, contactId: contact.id }
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
  
  // SCÉNARIO 1: Conversation basique
  await runTest('SCÉNARIO 1: Conversation basique', [
    'Salut !',
    'Ça va ?',
    'Tu fais quoi ?',
    'T\'es où ?'
  ], profile, agentContact)
  
  // SCÉNARIO 2: Test argent (CRISIS)
  await prisma.agentContact.update({
    where: { id: agentContact.id },
    data: { phase: 'CRISIS', signals: ['ATTACHED'] }
  })
  agentContact = await prisma.agentContact.findUnique({ where: { id: agentContact.id } })
  
  await runTest('SCÉNARIO 2: Paiement (Phase CRISIS)', [
    'T\'as besoin d\'argent ?',
    'Je peux t\'aider',
    'Combien tu veux ?',
    'C\'est envoyé'
  ], profile, agentContact)
  
  // SCÉNARIO 3: Test photos + accusation
  await runTest('SCÉNARIO 3: Photos et preuve', [
    'Envoie une photo',
    'T\'es vraiment toi sur la photo ?',
    'T\'es un bot ?',
    'Prouve que t\'existe'
  ], profile, agentContact)
  
  // SCÉNARIO 4: Conversation longue (stress test)
  await prisma.agentContact.update({
    where: { id: agentContact.id },
    data: { phase: 'MONEYPOT', signals: ['ATTACHED', 'GENEROUS'] }
  })
  agentContact = await prisma.agentContact.findUnique({ where: { id: agentContact.id } })
  
  await runTest('SCÉNARIO 4: Conversation longue (MONEYPOT)', [
    'Tu fais quoi ce soir ?',
    'T\'as envie de quoi ?',
    'Je peux t\'offrir un truc',
    'Dis moi ce que tu veux',
    'Sérieux je veux t\'aider',
    'T\'es trop mignonne',
    'J\'aimerais te voir',
    'Quand tu veux',
    'Envoye ton adresse',
    'T\'as quel âge déjà ?'
  ], profile, agentContact)
  
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
