import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 ANALYSE DÉTAILLÉE DES PROMPTS\n');

  const agents = await prisma.agent.findMany({
    include: { profile: true }
  });

  for (const agent of agents) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`👤 AGENT: ${agent.name} (${agent.phone})`);
    console.log(`${'='.repeat(70)}`);

    if (!agent.profile) {
      console.log('❌ AUCUN PROFIL');
      continue;
    }

    const p = agent.profile;

    // Analyse Identity
    console.log('\n📝 IDENTITY TEMPLATE (complet):');
    console.log(p.identityTemplate || '(vide)');

    // Analyse Mission  
    console.log('\n🎯 MISSION TEMPLATE (complet):');
    console.log(p.missionTemplate || '(vide)');

    // Analyse Style
    console.log('\n✍️ STYLE RULES (complet):');
    console.log(p.styleRules || '(vide)');

    // Analyse Phases
    console.log('\n🔄 PHASE TEMPLATES:');
    console.log('\n--- CONNECTION ---');
    console.log(p.phaseConnectionTemplate || '(vide)');
    console.log('\n--- VULNERABILITY ---');
    console.log(p.phaseVulnerabilityTemplate || '(vide)');
    console.log('\n--- CRISIS ---');
    console.log(p.phaseCrisisTemplate || '(vide)');
    console.log('\n--- MONEYPOT ---');
    console.log(p.phaseMoneypotTemplate || '(vide)');

    // Stats
    const templates = [
      p.identityTemplate,
      p.missionTemplate,
      p.styleRules,
      p.safetyRules,
      p.phaseConnectionTemplate,
      p.phaseVulnerabilityTemplate,
      p.phaseCrisisTemplate,
      p.phaseMoneypotTemplate
    ];
    
    const filled = templates.filter(t => t && t.length > 50).length;
    console.log(`\n📊 Stats: ${filled}/8 templates remplis`);
  }

  await prisma.$disconnect();
}

main();
