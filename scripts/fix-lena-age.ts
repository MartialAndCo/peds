/**
 * Corrige l'âge de Lena dans l'identityTemplate (17 → 15 / {{AGE}})
 */

import { prisma } from '../lib/prisma';

async function fixLenaAge() {
  console.log("🔧 CORRECTION DE L'ÂGE DE LENA\n");
  
  const agentId = 'cmkvfuyar00004uaximi0hhqw';
  
  const profile = await prisma.agentProfile.findUnique({
    where: { agentId },
    select: { identityTemplate: true, baseAge: true }
  });
  
  if (!profile) {
    console.log("Profil non trouvé");
    return;
  }
  
  console.log(`BaseAge: ${profile.baseAge}`);
  console.log(`\nAncien identityTemplate:\n${profile.identityTemplate?.substring(0, 300)}...\n`);
  
  // Remplacer tous les "17" par {{AGE}}
  const newIdentity = profile.identityTemplate
    ?.replace(/17 years old/g, '{{AGE}} years old')
    .replace(/17, high school/g, '{{AGE}}, high school')
    .replace(/17-year-old/g, '{{AGE}}-year-old')
    .replace(/17 ans/g, '{{AGE}} ans');
  
  await prisma.agentProfile.update({
    where: { agentId },
    data: { identityTemplate: newIdentity }
  });
  
  console.log(`\n✅ IdentityTemplate corrigé !`);
  console.log(`\nNouveau:\n${newIdentity?.substring(0, 300)}...`);
}

fixLenaAge().catch(console.error);
