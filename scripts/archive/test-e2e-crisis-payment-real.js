/**
 * TEST E2E RÉEL: Phase CRISIS avec paiement dynamique
 * 
 * Teste que l'IA:
 * 1. Mentionne une crise
 * 2. Propose SEULEMENT les moyens de paiement activés
 * 3. Ne hardcode pas PayPal
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testCrisisPhasePaymentReal() {
    console.log('=== TEST E2E RÉEL: PHASE CRISIS + PAIEMENT ===\n')

    const { director } = require('../lib/director')
    const { veniceService } = require('../lib/venice')
    const { settingsService } = require('../lib/settings-cache')

    // 1. Anaïs
    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } }
    })

    if (!anais) {
        console.log('❌ Agent non trouvé')
        return
    }

    console.log(`Agent: ${anais.name}\n`)

    // 2. Check payment settings
    const agentSettings = await prisma.agentSetting.findMany({
        where: { agentId: anais.id }
    })

    console.log('💳 Payment Settings pour cet agent:')
    const paymentSettings = agentSettings.filter(s => s.key.startsWith('payment_'))
    if (paymentSettings.length === 0) {
        console.log('  ⚠️ AUCUN moyen de paiement configuré!')
        console.log('  Pour tester, ajouter dans Prisma Studio → AgentSetting:')
        console.log('    - agentId: ' + anais.id)
        console.log('    - key: payment_paypal_enabled, value: true')
        console.log('    - key: payment_paypal_username, value: anais@example.com')
        console.log('\n  Ou pour tester le warning:')
        console.log('    - Ne rien configurer (test actuel)\n')
    } else {
        paymentSettings.forEach(s => console.log(`  ${s.key}: ${s.value}`))
        console.log('')
    }

    // 3. Mock contact
    const testContact = {
        id: 'test-crisis-contact',
        phone_whatsapp: '+33600000002',
        name: 'Thomas',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
    }

    // 4. Settings
    const settings = await settingsService.getAllSettings()

    // 5. Build prompt avec CRISIS
    console.log('📝 Construction prompt CRISIS...')
    const systemPrompt = await director.buildSystemPrompt(
        settings,
        testContact,
        'CRISIS',
        { trustScore: 60, daysActive: 7 },
        'Tu es Anaïs, une fille de 15 ans de Paris',
        anais.id,
        'Trust built, phase transition'
    )

    console.log(`✅ Prompt construit`)

    // Extract payment section pour debug
    const paymentSection = systemPrompt.match(/MOYENS DE PAIEMENT[\s\S]{0,800}/)?.[0]
    if (paymentSection) {
        console.log('\n📋 Section paiement injectée:')
        console.log('---')
        console.log(paymentSection.substring(0, 500))
        console.log('...')
        console.log('---\n')
    }

    // 6. Test conversation CRISIS
    const messages = [
        { role: 'user', content: 'ça va?' },
        { role: 'assistant', content: 'pas trop en vrai je stress' },
        { role: 'user', content: 'pourquoi qu\'est-ce qui se passe' }
    ]

    console.log('💬 Simulation conversation CRISIS...\n')

    try {
        const response = await veniceService.chat(
            systemPrompt,
            messages,
            {
                temperature: 0.8,
                max_tokens: 200
            }
        )

        console.log('✅ Réponse IA:\n')
        console.log('---')
        console.log(response)
        console.log('---\n')

        // 7. Vérifications
        console.log('📊 Vérifications:')

        const mentionsCrisis = response.includes('panique') ||
            response.includes('stress') ||
            response.includes('problème') ||
            response.includes('galère')
        console.log(`  Mentionne crise: ${mentionsCrisis ? '✅' : '❌'}`)

        const mentionsPayPal = response.toLowerCase().includes('paypal')
        const mentionsCashApp = response.toLowerCase().includes('cashapp')
        const mentionsVenmo = response.toLowerCase().includes('venmo')

        console.log(`  Mentionne PayPal: ${mentionsPayPal ? '⚠️ Vérifier si activé' : '✅ Non'}`)
        console.log(`  Mentionne CashApp: ${mentionsCashApp ? '⚠️ Vérifier si activé' : '✅ Non'}`)
        console.log(`  Mentionne Venmo: ${mentionsVenmo ? '⚠️ Vérifier si activé' : '✅ Non'}`)

        console.log('\n💡 Note: L\'IA ne devrait mentionner que les moyens activés dans AgentSettings')
        console.log('          Si aucun moyen configuré, elle peut dire "j\'ai pas de moyen"')

    } catch (e) {
        console.error('❌ Erreur Venice:', e.message)
    }
}

testCrisisPhasePaymentReal()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
