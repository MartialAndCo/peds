import { prisma } from '@/lib/prisma'

async function createTestContact() {
  const agentId = 'cmlci2qc900009vxdo9dnjuem' // Anaïs
  
  console.log('📱 Vérification contact de test pour Anaïs...\n')
  
  // 1. Récupérer ou créer le contact
  let contact = await prisma.contact.findUnique({
    where: { phone_whatsapp: '33612345678' }
  })
  
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        phone_whatsapp: '33612345678',
        name: 'TestUser',
        source: 'test',
        agentPhase: 'CONNECTION',
        trustScore: 0
      }
    })
    console.log('   ✅ Contact créé')
  } else {
    console.log('   ℹ️ Contact existant réutilisé')
  }
  
  // 2. Vérifier l'AgentContact
  const existingAgentContact = await prisma.agentContact.findUnique({
    where: {
      agentId_contactId: {
        agentId,
        contactId: contact.id
      }
    }
  })
  
  if (!existingAgentContact) {
    await prisma.agentContact.create({
      data: {
        agentId,
        contactId: contact.id,
        phase: 'CONNECTION',
        trustScore: 0,
        signals: []
      }
    })
    console.log('   ✅ AgentContact créé')
  } else {
    console.log('   ℹ️ AgentContact existant réutilisé')
  }
  
  // 3. Créer un prompt si pas existant
  let prompt = await prisma.prompt.findFirst()
  if (!prompt) {
    prompt = await prisma.prompt.create({
      data: {
        name: 'Default',
        system_prompt: 'Default prompt',
        model: 'venice-uncensored',
        temperature: 0.7,
        max_tokens: 500
      }
    })
    console.log('   ✅ Prompt créé')
  }
  
  // 4. Vérifier la conversation
  const existingConv = await prisma.conversation.findFirst({
    where: { contactId: contact.id, agentId }
  })
  
  let conversation
  if (!existingConv) {
    conversation = await prisma.conversation.create({
      data: {
        contactId: contact.id,
        agentId,
        status: 'active',
        ai_enabled: true,
        promptId: prompt.id
      }
    })
    console.log('   ✅ Conversation créée')
  } else {
    conversation = existingConv
    console.log('   ℹ️ Conversation existante réutilisée')
  }
  
  console.log('\n✅ SETUP TERMINÉ :')
  console.log(`   Contact ID: ${contact.id}`)
  console.log(`   Téléphone: ${contact.phone_whatsapp}`)
  console.log(`   Agent ID: ${agentId}`)
  console.log(`   Conversation ID: ${conversation.id}`)
  console.log(`   Phase: CONNECTION`)
}

createTestContact()
  .catch(console.error)
  .finally(() => process.exit(0))
