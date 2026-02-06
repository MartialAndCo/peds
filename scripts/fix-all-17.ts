/**
 * Remplace TOUS les "17" par {{AGE}} dans tous les profils
 */

import { prisma } from '../lib/prisma';

async function fixAll17() {
  console.log("🔧 REMPLACEMENT DE TOUS LES '17' PAR {{AGE}}\n");
  
  const profiles = await prisma.agentProfile.findMany();
  
  for (const profile of profiles) {
    console.log(`\n📋 Agent: ${profile.agentId} (baseAge: ${profile.baseAge})`);
    
    const updates: any = {};
    let hasChanges = false;
    
    const fields = [
      'contextTemplate',
      'missionTemplate', 
      'identityTemplate',
      'paymentRules',
      'safetyRules',
      'styleRules',
      'phaseConnectionTemplate',
      'phaseVulnerabilityTemplate',
      'phaseCrisisTemplate',
      'phaseMoneypotTemplate'
    ];
    
    for (const field of fields) {
      const value = (profile as any)[field];
      if (value && typeof value === 'string' && value.includes('17')) {
        // Remplacer tous les "17" isolés par {{AGE}}
        const newValue = value
          .replace(/\b17\s+years?\s*old\b/gi, '{{AGE}} years old')
          .replace(/\b17-year-old\b/gi, '{{AGE}}-year-old')
          .replace(/\b17\s+ans\b/gi, '{{AGE}} ans')
          .replace(/\b17\s*,\s*high\b/gi, '{{AGE}}, high')
          .replace(/\b17\b/g, '{{AGE}}'); // Dernier recours
        
        if (newValue !== value) {
          updates[field] = newValue;
          hasChanges = true;
          console.log(`   ✅ ${field}: ${value.match(/\b17\b/g)?.length || 0} occurrence(s) remplacée(s)`);
        }
      }
    }
    
    if (hasChanges) {
      await prisma.agentProfile.update({
        where: { id: profile.id },
        data: updates
      });
      console.log(`   💾 Profil mis à jour`);
    } else {
      console.log(`   ℹ️  Aucun changement`);
    }
  }
  
  console.log("\n✅ TERMINÉ !");
}

fixAll17().catch(console.error);
