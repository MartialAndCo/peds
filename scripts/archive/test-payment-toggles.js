const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * TEST E2E: Vérifier le système de toggle des moyens de paiement
 * - Check quels moyens sont activés dans AgentSettings
 * - Vérifie que paymentRules mentionne de checker les settings
 */

async function testPaymentToggles() {
    console.log('=== TEST: PAYMENT TOGGLES SYSTEM ===\n')

    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } },
        include: {
            profile: true,
            settings: true
        }
    })

    if (!anais) {
        console.log('❌ Agent non trouvé')
        return
    }

    console.log(`Agent: ${anais.name}\n`)

    // Check payment settings
    const paymentSettings = anais.settings.filter(s =>
        s.key.includes('paypal') ||
        s.key.includes('cashapp') ||
        s.key.includes('venmo') ||
        s.key.includes('payment')
    )

    console.log('💳 Payment Settings trouvés:')
    if (paymentSettings.length === 0) {
        console.log('  ⚠️  Aucun payment setting trouvé')
        console.log('  ℹ️  AgentSettings devrait contenir:')
        console.log('     - paypal_email (ou paypal_enabled)')
        console.log('     - cashapp_tag (ou cashapp_enabled)')
        console.log('     - venmo_handle (ou venmo_enabled)')
    } else {
        paymentSettings.forEach(s => {
            console.log(`  - ${s.key}: ${s.value || '(empty)'}`)
        })
    }

    // Check payment rules
    const hasToggleLogic = anais.profile?.paymentRules?.includes('AgentSettings') ||
        anais.profile?.paymentRules?.includes('toggle') ||
        anais.profile?.paymentRules?.includes('activés')

    console.log('\n📋 Payment Rules:')
    console.log(`  Mentionne système de toggle: ${hasToggleLogic ? '✅' : '❌'}`)

    if (!hasToggleLogic) {
        console.log('\n⚠️  PROBLÈME: paymentRules ne mentionne pas le système de toggle')
        console.log('    L\'IA risque de hardcoder PayPal au lieu de checker les settings')
    }

    console.log('\n🔍 Test manuel requis:')
    console.log('1. Activer/désactiver moyens de paiement dans AgentSettings')
    console.log('2. Simuler phase CRISIS')
    console.log('3. Vérifier que l\'IA propose SEULEMENT les moyens activés')

    console.log('\n💡 Recommandation pour Director:')
    console.log('   Le Director doit injecter les moyens de paiement disponibles')
    console.log('   dans le context du prompt (variable {{PAYMENT_METHODS}})')
}

testPaymentToggles()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
