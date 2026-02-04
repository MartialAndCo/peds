import { prisma } from '../lib/prisma';

async function main() {
  const agent = await prisma.agent.findUnique({
    where: { id: 'cmkvg0kzz00003vyv03zzt9kc' },
    include: { blacklistRules: true }
  });
  
  console.log('=== BLACKLIST RULES POUR ANAÏS ===');
  console.log(`Agent: ${agent?.name || 'Anaïs'}`);
  console.log(`Nombre de règles: ${agent?.blacklistRules.length || 0}\n`);
  
  if (agent?.blacklistRules && agent.blacklistRules.length > 0) {
    for (const rule of agent.blacklistRules) {
      console.log(`- "${rule.term}"`);
      console.log(`  Phase: ${rule.phase} | Media: ${rule.mediaType}`);
      console.log();
    }
  } else {
    console.log('Aucune règle blacklist définie.');
  }
  
  // Vérifier aussi les règles globales (sans agentId)
  const globalRules = await prisma.blacklistRule.findMany({
    where: { agentId: null }
  });
  
  console.log(`\n=== RÈGLES GLOBALES ===`);
  console.log(`Nombre: ${globalRules.length}\n`);
  
  for (const rule of globalRules) {
    console.log(`- "${rule.term}"`);
    console.log(`  Phase: ${rule.phase} | Media: ${rule.mediaType}`);
    console.log();
  }
  
  await prisma.$disconnect();
}

main();
