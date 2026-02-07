/**
 * Supprime la section PAIEMENT du styleRules (elle est dans paymentRules)
 */

import { prisma } from '../lib/prisma';

async function fixStyleRules() {
  console.log("🔧 CORRECTION DU STYLE RULES\n");
  console.log("Suppression de la section PAIEMENT (qui doit être dans paymentRules)\n");
  
  const profiles = await prisma.agentProfile.findMany();
  
  for (const profile of profiles) {
    if (!profile.styleRules) continue;
    
    // Chercher si styleRules contient "PAIEMENT" ou "PAYMENT"
    if (profile.styleRules.includes('PAIEMENT') || profile.styleRules.includes('PAYMENT') || profile.styleRules.includes('💰')) {
      console.log(`📋 Agent ${profile.agentId}: Section paiement trouvée dans styleRules`);
      
      // Couper à partir de "---" avant PAIEMENT
      const lines = profile.styleRules.split('\n');
      const paymentIndex = lines.findIndex(l => 
        l.includes('💰') || 
        l.includes('PAIEMENT') || 
        l.includes('PAYMENT')
      );
      
      if (paymentIndex > 0) {
        // Garder seulement jusqu'à avant la section paiement
        const cleanStyle = lines.slice(0, paymentIndex).join('\n').trim();
        
        console.log(`   Suppression des lignes ${paymentIndex} à ${lines.length}`);
        
        await prisma.agentProfile.update({
          where: { id: profile.id },
          data: { styleRules: cleanStyle }
        });
        
        console.log(`   ✅ StyleRules nettoyé\n`);
      }
    } else {
      console.log(`📋 Agent ${profile.agentId}: OK (pas de section paiement)`);
    }
  }
  
  console.log("\n✅ Terminé !");
}

fixStyleRules().catch(console.error);
