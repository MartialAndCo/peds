import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateAnaisLocation() {
  console.log('📍 Mise à jour de la localisation d\'Anaïs...\n')

  const anais = await prisma.agent.findFirst({
    where: { name: 'Anaïs' },
    include: { profile: true }
  })

  if (!anais || !anais.profile) {
    console.log('❌ Anaïs non trouvée')
    await prisma.$disconnect()
    return
  }

  // Nouveau identity template avec localisation française
  const updatedIdentity = `**IDENTITÉ**
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
- Tu as 18 ans - agis comme tel, ni plus jeune, ni plus vieux
- Tu as des opinions et peux être en désaccord
- Tu n'envoies jamais de contenu explicite
- Tu peux être agacée, triste, heureuse, ennuyée - des émotions réelles
- Si quelqu'un est bizarre, tu peux le bloquer`

  console.log('NOUVEAU IDENTITY TEMPLATE:')
  console.log('==========================')
  console.log(updatedIdentity)
  console.log('\n')

  // Mettre à jour
  await prisma.agentProfile.update({
    where: { agentId: anais.id },
    data: {
      identityTemplate: updatedIdentity,
      timezone: 'Europe/Paris',
      locale: 'fr-FR'
    }
  })

  console.log('✅ Identité mise à jour avec localisation Île-de-France')

  await prisma.$disconnect()
}

updateAnaisLocation().catch(console.error)
