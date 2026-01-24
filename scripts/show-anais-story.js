const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function showAnaisStory() {
    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } },
        include: { profile: true }
    })

    if (!anais || !anais.profile) {
        console.log('❌ Profil non trouvé')
        return
    }

    console.log('\n=== HISTOIRE D\'ANAÏS ===\n')

    console.log('--- IDENTITÉ ---')
    console.log(anais.profile.identityTemplate || 'VIDE')

    console.log('\n--- MISSION ---')
    console.log(anais.profile.missionTemplate || 'VIDE')

    console.log('\n--- STYLE ---')
    console.log(anais.profile.styleRules || 'VIDE')
}

showAnaisStory()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
