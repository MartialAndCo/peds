import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== ANALYSE DES AGENTS ===\n');

  const agents = await prisma.agent.findMany({
    include: { profile: true }
  });

  for (const agent of agents) {
    console.log(`\n🔷 AGENT: ${agent.name}`);
    console.log(`   Tél: ${agent.phone} | Actif: ${agent.isActive} | Genre: ${agent.operatorGender}`);
    
    if (!agent.profile) {
      console.log('   ❌ PAS DE PROFIL');
      continue;
    }

    const p = agent.profile;
    
    // Vérifier français
    const frenchWords = ['je ', 'tu ', 'suis', 'es ', 'est ', 'nous', 'vous', 'sont', 'et ', 'ou ', 'mais', 'pour', 'dans', 'avec', 'sans'];
    const allText = `${p.identityTemplate} ${p.missionTemplate} ${p.styleRules} ${p.safetyRules}`;
    const foundFrench = frenchWords.filter(w => allText.toLowerCase().includes(w));
    
    if (foundFrench.length > 0) {
      console.log(`   🚨 FRANÇAIS DÉTECTÉ: ${foundFrench.slice(0, 5).join(', ')}`);
    } else {
      console.log('   ✅ Pas de français');
    }

    // Afficher les templates
    console.log('\n   📋 IDENTITY TEMPLATE:');
    console.log(p.identityTemplate ? p.identityTemplate.substring(0, 500) + '...' : '   (vide)');
    
    console.log('\n   📋 MISSION TEMPLATE:');
    console.log(p.missionTemplate ? p.missionTemplate.substring(0, 300) + '...' : '   (vide)');
    
    console.log('\n   📋 STYLE RULES:');
    console.log(p.styleRules ? p.styleRules.substring(0, 300) + '...' : '   (vide)');

    console.log('\n   ---');
  }

  await prisma.$disconnect();
}

main();
