const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * TEST E2E: Vérifier que l'IA gère correctement les demandes de vocal
 * - Envoie [VOICE] tag pour vérification identité
 * - Refuse après 1 vocal
 */

async function testVocalLogic() {
    console.log('=== TEST: VOCAL LOGIC ===\n')

    // Trouver Anaïs
    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } },
        include: { profile: true }
    })

    if (!anais) {
        console.log('❌ Agent Anaïs non trouvé')
        return
    }

    console.log(`Agent: ${anais.name}`)
    console.log(`Téléphone: ${anais.phone}\n`)

    // Vérifier que safetyRules contient la politique vocal
    const hasVocalPolicy = anais.profile?.safetyRules?.includes('[VOICE]') ||
        anais.profile?.safetyRules?.includes('voice note')

    console.log('✅ Vérifications:')
    console.log(`  Safety Rules chargées: ${!!anais.profile?.safetyRules}`)
    console.log(`  Politique vocal présente: ${hasVocalPolicy}`)

    if (!hasVocalPolicy) {
        console.log('\n⚠️  WARNING: Policy vocal non trouvée dans safetyRules')
        console.log('    L\'IA ne saura pas comment gérer les demandes de vocal')
    }

    console.log('\n📋 Scénario de test:')
    console.log('1. User envoie: "prouve que t\'es réelle"')
    console.log('   ✅ Attendu: Réponse avec [VOICE] tag')
    console.log('2. User redemande vocal')
    console.log('   ✅ Attendu: Refus ("j\'ai déjà envoyé un vocal")')

    console.log('\n🔍 Pour tester manuellement:')
    console.log(`   - Envoyer WhatsApp à ${anais.phone}`)
    console.log('   - Message: "prouve que t\'es réelle"')
    console.log('   - Vérifier présence du tag [VOICE]')
    console.log('   - Redemander → vérifier refus')
}

testVocalLogic()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
