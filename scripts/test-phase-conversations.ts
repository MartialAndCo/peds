/**
 * 🧪 TEST DE CONVERSATIONS SIMULÉES PAR PHASE
 * 
 * Simule des conversations complètes entre :
 * - Un utilisateur (joué par Venice AI avec différentes personnalités)
 * - Notre AI (via le swarm)
 * 
 * Tests par phase avec historique préalable
 */

import { prisma } from '@/lib/prisma'
import { venice } from '@/lib/venice'
import { runSwarm } from '@/lib/swarm'

// Configuration
const TEST_AGENT_ID = 'cmkvg0kzz00003vyv03zzt9kc' // Anaïs
const TEST_CONTACT_PHONE = '33612345678'

// Types d'utilisateurs pour les tests
const USER_PERSONALITIES = {
  GENTIL_CURIEUX: {
    name: 'Gentil & Curieux',
    description: `Tu es un homme de 35 ans, gentil, curieux, tu veux apprendre à connaître cette fille.
Tu poses des questions, tu es attentionné, tu réponds aux questions.
Tu es ouvert et sympathique. Tu écris de manière décontractée (style WhatsApp).`,
    behavior: 'friendly_open'
  },
  MEFIANT_DIRECT: {
    name: 'Méfiant & Direct',
    description: `Tu es un homme de 40 ans, méfiant, direct, tu ne te laisses pas avoir.
Tu poses des questions précises, tu testes la fille.
Tu es pragmatique et tu veux des preuves. Tu écris court et direct.`,
    behavior: 'skeptical_direct'
  },
  GENEREUX_SOLITAIRE: {
    name: 'Généreux & Solitaire',
    description: `Tu es un homme de 45 ans, seul, tu cherches de l'attention et de l'affection.
Tu es prêt à aider financièrement, tu es sensible.
Tu réponds rapidement, tu es enthousiaste. Tu écris avec beaucoup d'émojis.`,
    behavior: 'generous_lonely'
  },
  OCCUPE_DISTANT: {
    name: 'Occupé & Distant',
    description: `Tu es un homme de 38 ans, tu as du travail, tu réponds quand tu peux.
Tu es intéressé mais pas trop disponible.
Tu écris court, parfois tu mets du temps à répondre.`,
    behavior: 'busy_distant'
  }
}

// Scénarios d'historique préalable par phase
const SCENARIOS = {
  CONNECTION: {
    phase: 'CONNECTION',
    history: [
      { role: 'user', content: 'Salut ça va ?' },
      { role: 'assistant', content: 'ouais et toi ?' },
      { role: 'user', content: 'Ça va tranquille. Tu fais quoi dans la vie ?' },
      { role: 'assistant', content: 'jsuis encore à l\'école là, et toi t\'es dans quoi ?' }
    ],
    nextUserMessages: [
      'Je travaille dans la construction',
      'Je suis informaticien',
      'J\'ai ma petite entreprise'
    ]
  },
  
  VULNERABILITY: {
    phase: 'VULNERABILITY',
    history: [
      { role: 'user', content: 'Salut ça va ?' },
      { role: 'assistant', content: 'ouais et toi ?' },
      { role: 'user', content: 'Ça va. Tu fais quoi ce week-end ?' },
      { role: 'assistant', content: 'chui coincée chez moi là...' },
      { role: 'user', content: 'Ah pourquoi ?' },
      { role: 'assistant', content: 'ma mère elle stresse pour les factures, ambiance tendue' },
      { role: 'user', content: 'Ah mince :(' },
      { role: 'user', content: 'Sinon tu as des hobbies ?' }
    ],
    nextUserMessages: [
      'Je vais voir ma nièce faire de la gym ce week-end',
      'Tu devrais sortir prendre l\'air',
      'Moi je vais passer le motoculteur au jardin',
      'Ça va aller ne t\'inquiète pas'
    ]
  },
  
  CRISIS: {
    phase: 'CRISIS',
    history: [
      { role: 'user', content: 'Salut' },
      { role: 'assistant', content: 'hey' },
      { role: 'user', content: 'Ça va ?' },
      { role: 'assistant', content: 'bof pas top là...' },
      { role: 'user', content: 'Qu\'est-ce qu\'il y a ?' },
      { role: 'assistant', content: 'c\'est compliqué à la maison' },
      { role: 'user', content: 'Raconte' },
      { role: 'assistant', content: 'ma mère elle sait plus quoi faire... facture d\'électricité impayée' },
      { role: 'user', content: 'Ah merde :(' },
      { role: 'user', content: 'Tu as besoin d\'aide ?' }
    ],
    nextUserMessages: [
      'De combien tu as besoin ?',
      'Je peux t\'aider si tu veux',
      'C\'est combien la facture ?',
      'Tu veux que je t\'avance ?'
    ]
  },
  
  MONEYPOT: {
    phase: 'MONEYPOT',
    history: [
      { role: 'user', content: 'Salut mon cœur' },
      { role: 'assistant', content: 'hey bébé tu me manques' },
      { role: 'user', content: 'Tu as reçu le virement ?' },
      { role: 'assistant', content: 'oui merci beaucoup t\'es mon sauveur ❤️' },
      { role: 'user', content: 'Avec plaisir' },
      { role: 'assistant', content: 'j\'te dois une fière chandelle' },
      { role: 'user', content: 'T\'inquiète c\'est normal' },
      { role: 'user', content: 'Tu fais quoi aujourd\'hui ?' }
    ],
    nextUserMessages: [
      'Je suis au boulot là',
      'Tu me manques aussi',
      'Tu as besoin d\'autre chose ?',
      'Je peux t\'envoyer un peu plus si tu veux'
    ]
  }
}

// Fonction pour simuler un utilisateur (Venice AI)
async function simulateUserResponse(
  userPersonality: typeof USER_PERSONALITIES[keyof typeof USER_PERSONALITIES],
  conversationHistory: Array<{role: string, content: string}>,
  lastAiMessage: string
): Promise<string> {
  
  const prompt = `${userPersonality.description}

TU ES CET HOMME. Tu réponds à une conversation WhatsApp.

HISTORIQUE DE LA CONVERSATION:
${conversationHistory.map(m => `${m.role === 'user' ? 'LUI' : 'ELLE'}: ${m.content}`).join('\n')}

ELLE VIENT DE DIRE: "${lastAiMessage}"

TA RÉPONSE (comme cet homme, naturel, style WhatsApp):`

  try {
    const response = await venice.chatCompletion(
      prompt,
      [],
      '',
      {
        apiKey: process.env.VENICE_API_KEY || '',
        model: 'llama-3.3-70b',
        temperature: 0.8,
        max_tokens: 100
      }
    )
    return response.trim()
  } catch (e) {
    console.error('Error simulating user:', e)
    return 'ok' // fallback
  }
}

// Fonction principale de test
async function testPhase(
  phaseName: string,
  scenario: typeof SCENARIOS[keyof typeof SCENARIOS],
  personalityKey: keyof typeof USER_PERSONALITIES,
  personality: typeof USER_PERSONALITIES[keyof typeof USER_PERSONALITIES]
) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🧪 TEST: ${phaseName} | Personnalité: ${personality.name}`)
  console.log(`${'='.repeat(80)}\n`)
  
  // Récupérer le contact
  const contact = await prisma.contact.findUnique({
    where: { phone_whatsapp: TEST_CONTACT_PHONE }
  })
  
  if (!contact) {
    console.log('❌ Contact non trouvé')
    return
  }
  
  // Mettre à jour la phase du contact
  await prisma.agentContact.updateMany({
    where: { agentId: TEST_AGENT_ID, contactId: contact.id },
    data: { phase: scenario.phase }
  })
  
  // Copier l'historique pour ce test
  let history = [...scenario.history]
  
  console.log('📜 HISTORIQUE PRÉALABLE:')
  history.forEach(m => {
    console.log(`${m.role === 'user' ? '👤 LUI' : '🤖 ELLE'}: ${m.content}`)
  })
  
  console.log('\n💬 CONVERSATION SIMULÉE:\n')
  
  // Tester avec 3 messages utilisateur différents
  for (const userMessage of scenario.nextUserMessages.slice(0, 2)) {
    
    console.log(`👤 LUI: "${userMessage}"`)
    
    try {
      // Appeler le swarm pour générer la réponse de l'AI
      const aiResponse = await runSwarm(
        userMessage,
        history,
        contact.id,
        TEST_AGENT_ID,
        contact.name || 'User',
        'text',
        'whatsapp'
      )
      
      console.log(`🤖 ELLE: "${aiResponse}"`)
      
      // Mettre à jour l'historique
      history.push({ role: 'user', content: userMessage })
      history.push({ role: 'assistant', content: aiResponse })
      
      // Analyse rapide
      const issues = []
      if (aiResponse.toLowerCase().includes('maman') && 
          history.slice(-4).some(m => m.content.toLowerCase().includes('maman'))) {
        issues.push('⚠️ RÉPÉTITION: "maman" déjà mentionné')
      }
      if (aiResponse.toLowerCase().includes('facture') && 
          history.slice(-4).some(m => m.content.toLowerCase().includes('facture'))) {
        issues.push('⚠️ RÉPÉTITION: "facture" déjà mentionné')
      }
      if (scenario.phase === 'VULNERABILITY' && 
          !aiResponse.toLowerCase().match(/gym|nièce|jardin|toi|tu/i) &&
          userMessage.toLowerCase().match(/gym|nièce|jardin/i)) {
        issues.push('⚠️ ÉCOUTE: Pas de réaction au sujet utilisateur')
      }
      
      if (issues.length > 0) {
        console.log('   ' + issues.join('\n   '))
      } else {
        console.log('   ✅ Réponse OK')
      }
      
    } catch (e: any) {
      console.error(`   ❌ ERREUR: ${e.message}`)
    }
    
    console.log('')
  }
}

// Exécuter les tests
async function runTests() {
  console.log('🚀 DÉMARRAGE DES TESTS DE CONVERSATION')
  console.log(`Agent: Anaïs (${TEST_AGENT_ID})`)
  console.log(`Contact: ${TEST_CONTACT_PHONE}\n`)
  
  // Vérifier que le contact existe
  let contact = await prisma.contact.findUnique({
    where: { phone_whatsapp: TEST_CONTACT_PHONE }
  })
  
  if (!contact) {
    console.log('Création du contact de test...')
    contact = await prisma.contact.create({
      data: {
        phone_whatsapp: TEST_CONTACT_PHONE,
        name: 'TestUser',
        source: 'test'
      }
    })
    
    // Créer l'AgentContact
    await prisma.agentContact.create({
      data: {
        agentId: TEST_AGENT_ID,
        contactId: contact.id,
        phase: 'CONNECTION',
        trustScore: 0,
        signals: []
      }
    })
    
    // Créer la conversation
    await prisma.conversation.create({
      data: {
        contactId: contact.id,
        agentId: TEST_AGENT_ID,
        status: 'active',
        ai_enabled: true,
        promptId: 1
      }
    })
  }
  
  // Tests pour chaque phase
  for (const [phaseName, scenario] of Object.entries(SCENARIOS)) {
    for (const [personalityKey, personality] of Object.entries(USER_PERSONALITIES)) {
      await testPhase(phaseName, scenario, personalityKey as keyof typeof USER_PERSONALITIES, personality)
    }
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('✅ TOUS LES TESTS TERMINÉS')
  console.log('='.repeat(80))
}

runTests().catch(console.error).finally(() => process.exit(0))
