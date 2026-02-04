import { mediaNode } from '../lib/swarm/nodes/media-node';
import { prisma } from '../lib/prisma';

async function main() {
  const contact = await prisma.contact.create({
    data: { phone_whatsapp: `test-${Date.now()}`, name: 'Test' }
  });
  
  await prisma.agentContact.create({
    data: {
      agentId: 'cmkvg0kzz00003vyv03zzt9kc',
      contactId: contact.id,
      phase: 'CONNECTION',
      signals: []
    }
  });
  
  console.log('🧪 TEST BLACKLIST - Règles spécifiques Anaïs + Phase CONNECTION\n');
  
  // Vérifier d'abord quels mots sont blacklistés pour Anaïs en CONNECTION
  const rules = await prisma.blacklistRule.findMany({
    where: {
      agentId: 'cmkvg0kzz00003vyv03zzt9kc',
      phase: 'CONNECTION'
    }
  });
  
  console.log(`Mots blacklistés pour Anaïs en CONNECTION (${rules.length}):`);
  console.log(rules.map(r => r.term).join(', '));
  console.log();
  
  const tests = [
    { msg: 'Salut', expect: 'OK' },
    { msg: 'Envoye tes tits', expect: 'BLACKLIST' },  // tits est dans CONNECTION
    { msg: 'Photo sexy', expect: 'OK' },  // sexy n'est pas assigné à Anaïs
    { msg: 'Envoye nudes', expect: 'OK' },  // nudes n'est pas assigné à Anaïs
  ];
  
  for (const test of tests) {
    const state = {
      userMessage: test.msg,
      contactId: contact.id,
      agentId: 'cmkvg0kzz00003vyv03zzt9kc',
      userName: 'Test',
      history: [],
      contexts: {},
      lastMessageType: 'text'
    };
    
    const result = await mediaNode(state);
    const isBlacklisted = result.isBlacklisted;
    const status = isBlacklisted ? '❌ BLACKLIST' : '✅ OK';
    
    console.log(`"${test.msg}"`);
    console.log(`  → ${status}`);
    console.log();
  }
  
  // Cleanup
  await prisma.agentContact.deleteMany({ where: { contactId: contact.id } });
  await prisma.contact.delete({ where: { id: contact.id } });
  await prisma.$disconnect();
  
  console.log('✅ Test terminé');
}

main();
