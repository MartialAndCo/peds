import { prisma } from '../lib/prisma';

async function checkDB() {
  console.log("🔍 VÉRIFICATION DES VALEURS EN BASE DE DONNÉES\n");
  console.log("=".repeat(70));
  
  const profiles = await prisma.agentProfile.findMany();
  
  for (const p of profiles) {
    console.log(`\n📋 Agent: ${p.agentId}`);
    console.log(`   baseAge: ${p.baseAge}`);
    
    // Chercher "17" dans tous les champs
    const fields = [
      { name: 'identityTemplate', value: p.identityTemplate },
      { name: 'contextTemplate', value: p.contextTemplate },
      { name: 'safetyRules', value: p.safetyRules },
    ];
    
    for (const field of fields) {
      if (field.value) {
        const matches17 = field.value.match(/\b17\b/g);
        const matchesAge = field.value.match(/\{\{AGE\}\}/g);
        
        console.log(`\n   ${field.name}:`);
        console.log(`      - "17" trouvé: ${matches17 ? matches17.length : 0} fois`);
        console.log(`      - "{{AGE}}" trouvé: ${matchesAge ? matchesAge.length : 0} fois`);
        
        if (matches17 && matches17.length > 0) {
          const lines = field.value.split('\n');
          const badLines = lines.filter(l => /\b17\b/.test(l));
          console.log(`      ⚠️ Lignes problématiques:`);
          badLines.forEach(l => console.log(`         "${l.trim().substring(0, 60)}"`));
        }
      }
    }
  }
  
  console.log("\n" + "=".repeat(70));
  console.log("✅ Vérification terminée");
}

checkDB();
