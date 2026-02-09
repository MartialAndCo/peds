import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Mise à jour des excuses de plateforme pour Lena et Anaïs\n');

  // Récupérer Lena
  const lena = await prisma.agent.findFirst({
    where: { name: { contains: 'Lena', mode: 'insensitive' } },
    include: { profile: true }
  });

  if (lena?.profile) {
    console.log('👤 Mise à jour de Lena (USA)...');
    
    // Récupérer l'identity actuelle
    const currentIdentity = lena.profile.identityTemplate || '';
    
    // Ajouter l'excuse de plateforme
    const platformExcuse = `

PLATEFORME - POURQUOI WHATSAPP/DISCORD:
- "Ma mère elle contrôle TOUT sur mon téléphone"
- "Instagram/Snapchat elle vérifie mes messages"
- "WhatsApp elle sait pas comment ça marche, elle regarde pas"
- "C'est la seule app où je peux parler tranquille"
- "Si tu veux qu'on parle c'est ici ou rien"
- "Discord c'est pareil, maman elle comprend pas les serv"`;

    const newIdentity = currentIdentity.includes('PLATEFORME') 
      ? currentIdentity 
      : currentIdentity + platformExcuse;

    await prisma.agentProfile.update({
      where: { agentId: lena.id },
      data: { identityTemplate: newIdentity }
    });
    
    console.log('   ✅ Excuse plateforme ajoutée pour Lena');
  }

  // Récupérer Anaïs
  const anais = await prisma.agent.findFirst({
    where: { name: { contains: 'Anaïs', mode: 'insensitive' } },
    include: { profile: true }
  });

  if (anais?.profile) {
    console.log('👤 Mise à jour de Anaïs (France)...');
    
    const currentIdentity = anais.profile.identityTemplate || '';
    
    const platformExcuse = `

PLATEFORME - POURQUOI WHATSAPP/DISCORD:
- "Ma mère elle me confisque le téléphone et vérifie tout"
- "Snapchat/Insta elle regarde mes conversations"
- "WhatsApp elle comprend pas, elle sait pas où chercher"
- "C'est la seule appli où je peux parler en paix"
- "Si tu veux qu'on discute c'est là ou jamais"
- "Discord c'est pareil, elle sait pas ce que c'est"`;

    const newIdentity = currentIdentity.includes('PLATEFORME')
      ? currentIdentity
      : currentIdentity + platformExcuse;

    await prisma.agentProfile.update({
      where: { agentId: anais.id },
      data: { identityTemplate: newIdentity }
    });
    
    console.log('   ✅ Excuse plateforme ajoutée pour Anaïs');
  }

  // Ajouter aussi dans les styleRules pour qu'elles l'utilisent naturellement
  const styleAddition = `

EXCUSE PLATEFORME (si on demande pourquoi WhatsApp/Discord):
- "ma mère elle contrôle tout sur les autres apps"
- "c'est la seule où elle regarde pas"
- "elle sait pas comment ça marche ici"
- "sur snap/insta elle vérifie mes messages"
- "je peux que parler ici sinon ciao"`;

  if (lena?.profile && !lena.profile.styleRules?.includes('PLATEFORME')) {
    await prisma.agentProfile.update({
      where: { agentId: lena.id },
      data: { 
        styleRules: (lena.profile.styleRules || '') + styleAddition 
      }
    });
    console.log('   ✅ Style rules mis à jour pour Lena');
  }

  if (anais?.profile && !anais.profile.styleRules?.includes('PLATEFORME')) {
    await prisma.agentProfile.update({
      where: { agentId: anais.id },
      data: { 
        styleRules: (anais.profile.styleRules || '') + styleAddition 
      }
    });
    console.log('   ✅ Style rules mis à jour pour Anaïs');
  }

  console.log('\n✅ Mise à jour terminée !');
  console.log('\nMaintenant Lena et Anaïs expliqueront:');
  console.log('- Pourquoi elles sont sur cette plateforme spécifique');
  console.log('- Que c\'est la seule où maman ne surveille pas');
  console.log('- Que les autres apps (Snap/Insta) sont contrôlées');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
