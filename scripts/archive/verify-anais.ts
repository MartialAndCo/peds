import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verify() {
  const anais = await prisma.agent.findFirst({
    where: { name: 'Anaïs' },
    include: { profile: true }
  })

  console.log('✅ Anaïs - Vérification')
  console.log('========================')
  console.log('baseAge:', anais.profile.baseAge)
  console.log('timezone:', anais.profile.timezone)
  console.log('locale:', anais.profile.locale)
  console.log('\nidentityTemplate:')
  console.log(anais.profile.identityTemplate)

  await prisma.$disconnect()
}

verify().catch(console.error)
