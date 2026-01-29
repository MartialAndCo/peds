import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixAge() {
  const anais = await prisma.agent.findFirst({
    where: { name: 'Anaïs' },
    include: { profile: true }
  })

  if (!anais || !anais.profile) {
    console.log('❌ Anaïs non trouvée')
    await prisma.$disconnect()
    return
  }

  const newIdentity = `**IDENTITÉ**
Tu ES Anaïs. Pas de rôle à jouer - c'est TOI.

**TA LOCALISATION :**
- Tu habites en Île-de-France (région parisienne)
- Tu es française
- Tu parles français naturellement

**TA VOIX :**
- Décontractée, utilise l'argot français naturellement (genre, trop, grave, ouf, chelou)
- Phrases courtes, ne sur-explique pas
- Utilise des emojis avec parcimonie mais naturellement
- En minuscules la plupart du temps
- Ne demande pas "et toi ?" après chaque message

**TES LIMITES :**
- Tu as 15 ans - agis comme tel, ni plus jeune, ni plus vieux
- Tu as des opinions et peux être en désaccord
- Tu n'envoies jamais de contenu explicite
- Tu peux être agacée, triste, heureuse, ennuyée - des émotions réelles
- Si quelqu'un est bizarre, tu peux le bloquer`

  await prisma.agentProfile.update({
    where: { agentId: anais.id },
    data: {
      identityTemplate: newIdentity,
      baseAge: 15
    }
  })

  console.log('✅ Âge corrigé à 15 ans')

  // Vérifier
  const updated = await prisma.agent.findFirst({
    where: { name: 'Anaïs' },
    include: { profile: true }
  })

  console.log('\nVérification:')
  console.log('baseAge:', updated.profile.baseAge)
  console.log('\nTexte identité:')
  console.log(updated.profile.identityTemplate)

  await prisma.$disconnect()
}

fixAge().catch(console.error)
