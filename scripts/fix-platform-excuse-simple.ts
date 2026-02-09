import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Correction des excuses de plateforme\n');

  // LENA - USA - EN ANGLAIS
  const lena = await prisma.agent.findFirst({
    where: { name: { contains: 'Lena', mode: 'insensitive' } },
    include: { profile: true }
  });

  if (lena?.profile) {
    console.log('👤 Correction de Lena (USA - EN ANGLAIS)...');
    
    const identityEn = lena.profile.identityTemplate?.replace(/PLATEFORME[\s\S]*$/, '') || '';
    
    const platformEn = `

PLATFORM - WHY ONLY WHATSAPP/DISCORD:
- "I don't have other apps"
- "No Insta, no Snap, no TikTok, nothing"
- "Just WhatsApp, that's it"
- "My mom took away everything else"
- "I only have this app, period"`;

    await prisma.agentProfile.update({
      where: { agentId: lena.id },
      data: { 
        identityTemplate: identityEn + platformEn,
        styleRules: (lena.profile.styleRules || '').replace(/EXCUSE PLATEFORME[\s\S]*$/, '') + `

PLATFORM EXCUSE (if asked about other apps):
- "i don't have other apps"
- "just whatsapp"
- "no insta no snap nothing"
- "only got this app"`
      }
    });
    console.log('   ✅ Lena corrigée (EN ANGLAIS)');
  }

  // ANAÏS - FRANCE - EN FRANÇAIS
  const anais = await prisma.agent.findFirst({
    where: { name: { contains: 'Anaïs', mode: 'insensitive' } },
    include: { profile: true }
  });

  if (anais?.profile) {
    console.log('👤 Correction de Anaïs (FRANCE - FRANÇAIS)...');
    
    const identityFr = anais.profile.identityTemplate?.replace(/PLATEFORME[\s\S]*$/, '') || '';
    
    const platformFr = `

PLATEFORME - POURQUOI QUE WHATSAPP/DISCORD:
- "J'ai pas d'autres applications"
- "Pas d'Insta, pas de Snap, pas de TikTok, rien"
- "Juste WhatsApp, c'est tout"
- "Ma mère m'a tout enlevé"
- "J'ai que cette appli, point final"`;

    await prisma.agentProfile.update({
      where: { agentId: anais.id },
      data: { 
        identityTemplate: identityFr + platformFr,
        styleRules: (anais.profile.styleRules || '').replace(/EXCUSE PLATEFORME[\s\S]*$/, '') + `

EXCUSE PLATEFORME (si on demande pourquoi pas d'autres apps):
- "j'ai pas d'autres applications"
- "juste whatsapp"
- "pas insta pas snap rien"
- "j'ai que cette appli"`
      }
    });
    console.log('   ✅ Anaïs corrigée (FRANÇAIS)');
  }

  console.log('\n✅ Corrections terminées !');
  console.log('\nMaintenant :');
  console.log('- Lena dira EN ANGLAIS: "I only have WhatsApp, nothing else"');
  console.log('- Anaïs dira EN FRANÇAIS: "J\'ai que WhatsApp, rien d\'autre"');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
