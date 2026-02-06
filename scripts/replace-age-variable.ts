/**
 * Remplace les âges en dur par {{AGE}} dans tous les prompts DB
 * Évite que l'IA dise des âges différents (17, 18, 14 au lieu de 15)
 */

import { prisma } from '../lib/prisma';

async function replaceAgeVariable() {
  console.log("🔍 Recherche de tous les prompts contenant des âges...\n");
  
  const profiles = await prisma.agentProfile.findMany();
  
  let updatedCount = 0;
  
  for (const profile of profiles) {
    const updates: any = {};
    let hasChanges = false;
    
    // Patterns pour détecter les âges (15 ans, 17 years, etc.)
    const agePattern = /(\d{1,2})\s*(ans?|years?)/gi;
    
    const fieldsToCheck = [
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
    
    for (const field of fieldsToCheck) {
      const value = (profile as any)[field];
      if (value && typeof value === 'string') {
        // Chercher les patterns d'âge
        const matches = [...value.matchAll(agePattern)];
        
        if (matches.length > 0) {
          console.log(`📋 Profile ${profile.agentId} - Champ: ${field}`);
          console.log(`   Trouvé ${matches.length} mention(s) d'âge: ${matches.map(m => m[0]).join(', ')}`);
          
          // Preview avant
          const lines = value.split('\n');
          const contextLines = lines.filter((l: string) => agePattern.test(l)).slice(0, 2);
          console.log(`   Contexte: "${contextLines.join(' | ').substring(0, 80)}..."`);
          
          // Remplacer par {{AGE}} ans / {{AGE}} years
          const newValue = value
            .replace(/(\d{1,2})\s*ans/gi, '{{AGE}} ans')
            .replace(/(\d{1,2})\s*years?/gi, '{{AGE}} years');
          
          updates[field] = newValue;
          hasChanges = true;
          console.log(`   ✅ Remplacé par {{AGE}}\n`);
        }
      }
    }
    
    if (hasChanges) {
      await prisma.agentProfile.update({
        where: { id: profile.id },
        data: updates
      });
      updatedCount++;
      console.log(`💾 Profile ${profile.agentId} mis à jour\n`);
    }
  }
  
  console.log(`\n🎉 Terminé ! ${updatedCount} profil(s) mis à jour.`);
  console.log('\n⚠️ IMPORTANT: Maintenant il faut modifier le code pour remplacer {{AGE}}');
  console.log('par baseAge au moment de générer les réponses.');
}

replaceAgeVariable().catch(console.error);
