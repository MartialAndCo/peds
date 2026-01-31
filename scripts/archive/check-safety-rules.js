const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkSafetyRules() {
    console.log('=== VÉRIFICATION SAFETY RULES EXISTANTES ===\n')

    const agents = await prisma.agent.findMany({
        include: { profile: true }
    })

    for (const agent of agents) {
        console.log(`\n--- ${agent.name} (${agent.locale}) ---`)

        if (!agent.profile) {
            console.log('❌ Pas de profile')
            continue
        }

        const sr = agent.profile.safetyRules

        if (!sr) {
            console.log('❌ Pas de safetyRules')
            continue
        }

        console.log(`Longueur: ${sr.length} chars`)
        console.log('\nContenu:')
        console.log('---')
        console.log(sr)
        console.log('---')
    }
}

checkSafetyRules()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
