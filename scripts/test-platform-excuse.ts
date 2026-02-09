import { PrismaClient } from '@prisma/client';
import { runSwarm } from '../lib/swarm';

const prisma = new PrismaClient();

async function testAgent(agentName: string, contactPhone: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TEST EXCUSE PLATEFORME - ${agentName.toUpperCase()}`);
  console.log('='.repeat(80));

  const agent = await prisma.agent.findFirst({
    where: { name: { contains: agentName, mode: 'insensitive' } }
  });

  if (!agent) {
    console.log(`❌ Agent ${agentName} non trouvé`);
    return;
  }

  // Trouver ou créer contact
  let contact = await prisma.contact.findFirst({
    where: { phone_whatsapp: contactPhone }
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        phone_whatsapp: contactPhone,
        name: 'TestUser',
        source: 'test',
        status: 'active'
      }
    });
  }

  // Créer AgentContact et Conversation si besoin
  let agentContact = await prisma.agentContact.findUnique({
    where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } }
  });

  if (!agentContact) {
    agentContact = await prisma.agentContact.create({
      data: {
        agentId: agent.id,
        contactId: contact.id,
        phase: 'CONNECTION',
        signals: []
      }
    });
  }

  let conversation = await prisma.conversation.findFirst({
    where: { contactId: contact.id, agentId: agent.id }
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        contactId: contact.id,
        agentId: agent.id,
        promptId: 1,
        status: 'active'
      }
    });
  }

  const tests = [
    { msg: "T'as pas Snapchat ?", desc: 'Demande Snapchat' },
    { msg: "Pourquoi t'es sur WhatsApp ?", desc: 'Question plateforme' },
    { msg: "Tu devrais avoir Insta", desc: 'Suggestion Instagram' },
    { msg: "T'as quel réseau social", desc: 'Demande réseaux' },
  ];

  const history: Array<{ role: string; content: string }> = [
    { role: 'user', content: 'Salut' },
    { role: 'assistant', content: agentName.toLowerCase() === 'lena' ? 'hey' : 'salut' },
    { role: 'user', content: 'Ça va' },
    { role: 'assistant', content: agentName.toLowerCase() === 'lena' ? 'yeah' : 'ouais' },
  ];

  for (const test of tests) {
    console.log(`\n[Test: ${test.desc}]`);
    console.log(`User: "${test.msg}"`);
    
    try {
      const response = await runSwarm(
        test.msg,
        history,
        contact.id,
        agent.id,
        'TestUser',
        'text',
        'whatsapp'
      );
      
      console.log(`${agentName}: "${response}"`);
      
      // Vérifier si l'excuse est présente
      const hasExcuse = response.toLowerCase().includes('mère') || 
                        response.toLowerCase().includes('maman') ||
                        response.toLowerCase().includes('contrôle') ||
                        response.toLowerCase().includes('surveille') ||
                        response.toLowerCase().includes('seule') ||
                        response.toLowerCase().includes('peux') ||
                        response.toLowerCase().includes('only') ||
                        response.toLowerCase().includes('mom');
      
      if (hasExcuse) {
        console.log('✅ EXCUSE PLATEFORME DÉTECTÉE');
      } else {
        console.log('⚠️ Pas d\'excuse évidente');
      }
      
      history.push({ role: 'user', content: test.msg });
      history.push({ role: 'assistant', content: response });
      
      // Limite historique
      if (history.length > 10) history.splice(0, 2);
      
    } catch (error) {
      console.error('❌ Erreur:', error);
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
}

async function main() {
  console.log('🚀 TEST EXCUSES DE PLATEFORME\n');
  
  await testAgent('Lena', '33611111111');
  await testAgent('Anaïs', '33622222222');
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ TESTS TERMINÉS');
  console.log('='.repeat(80));
  
  await prisma.$disconnect();
}

main().catch(console.error);
