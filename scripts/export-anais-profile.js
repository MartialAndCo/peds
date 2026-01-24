const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const prisma = new PrismaClient()

async function getAnaisProfile() {
    console.log('=== PROFIL COMPLET ANAÏS ===\n')

    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } },
        include: { profile: true }
    })

    if (!anais || !anais.profile) {
        console.log('❌ Profil non trouvé')
        return
    }

    const profile = anais.profile

    console.log(`Nom: ${anais.name}`)
    console.log(`Âge: ${anais.age}`)
    console.log(`Locale: ${anais.locale}`)
    console.log(`Téléphone: ${anais.phone}`)
    console.log(`\n--- TEMPLATES ---`)

    // Export tous les templates
    const fields = [
        'identityTemplate',
        'contextTemplate',
        'missionTemplate',
        'styleRules',
        'safetyRules',
        'paymentRules',
        'phaseConnectionTemplate',
        'phaseVulnerabilityTemplate',
        'phaseCrisisTemplate',
        'phaseMoneypotTemplate'
    ]

    for (const field of fields) {
        const content = profile[field]
        if (content) {
            const filename = `anais-${field}.txt`
            fs.writeFileSync(filename, content, 'utf-8')
            console.log(`✅ ${field}: ${content.length} chars → ${filename}`)
        } else {
            console.log(`⚠️  ${field}: VIDE`)
        }
    }

    console.log('\n✅ Tous les templates exportés')
}

getAnaisProfile()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
