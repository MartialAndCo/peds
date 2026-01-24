const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const prisma = new PrismaClient()

async function exportSafetyRules() {
    console.log('=== EXPORT SAFETY RULES COMPLET ===\n')

    const agents = await prisma.agent.findMany({
        include: { profile: true }
    })

    for (const agent of agents) {
        const filename = `safety-rules-${agent.name.toLowerCase()}.txt`

        console.log(`\n--- ${agent.name} (${agent.locale}) ---`)

        if (!agent.profile || !agent.profile.safetyRules) {
            console.log('❌ Pas de safetyRules')
            fs.writeFileSync(filename, 'PAS DE SAFETY RULES', 'utf-8')
            continue
        }

        const sr = agent.profile.safetyRules

        console.log(`✅ Exporté vers: ${filename}`)
        console.log(`   Longueur: ${sr.length} chars`)

        fs.writeFileSync(filename, sr, 'utf-8')
    }

    console.log('\n✅ Export terminé - Vérifier les fichiers .txt créés')
}

exportSafetyRules()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
