const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * TEST: Vérifier que Director remplace correctement {{PAYMENT_METHODS}}
 */

async function testPaymentMethodsInjection() {
    console.log('=== TEST: PAYMENT METHODS INJECTION ===\n')

    const { director } = require('../lib/director')

    // Créer un contact test
    const testContact = {
        phone_whatsapp: '+33600000000',
        name: 'Test User',
        id: 'test-contact-id'
    }

    // Mock settings (global)
    const settings = {
        ai_provider: 'venice'
    }

    // Trouver Anaïs
    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } }
    })

    if (!anais) {
        console.log('❌ Agent Anaïs non trouvé')
        return
    }

    console.log(`Agent: ${anais.name}`)
    console.log(`Agent ID: ${anais.id}\n`)

    // Check AgentSettings pour payment
    const agentSettings = await prisma.agentSetting.findMany({
        where: { agentId: anais.id }
    })

    const paymentSettings = agentSettings.filter(s => s.key.startsWith('payment_'))

    console.log('💳 Payment Settings:')
    if (paymentSettings.length === 0) {
        console.log('  ⚠️  Aucun payment setting trouvé pour cet agent')
        console.log('  Pour tester, ajouter dans AgentSettings:')
        console.log('     - payment_paypal_enabled: true')
        console.log('     - payment_paypal_username: anais@example.com')
    } else {
        paymentSettings.forEach(s => {
            console.log(`  ${s.key}: ${s.value}`)
        })
    }

    console.log('\n🔍 Building system prompt...')

    try {
        const systemPrompt = await director.buildSystemPrompt(
            settings,
            testContact,
            'CRISIS', // Phase où paiement est pertinent
            { trustScore: 50, daysActive: 5 },
            'Tu es Anaïs',
            anais.id,
            'Test'
        )

        console.log('\n✅ Prompt généré avec succès')

        // Check si {{PAYMENT_METHODS}} a été remplacé
        if (systemPrompt.includes('{{PAYMENT_METHODS}}')) {
            console.log('❌ PROBLÈME: {{PAYMENT_METHODS}} n\'a PAS été remplacé')
        } else {
            console.log('✅ {{PAYMENT_METHODS}} a été remplacé')
        }

        // Extract payment section
        const paymentSection = systemPrompt.match(/### MOYENS DE PAIEMENT[\s\S]*?(?=\n\n###|\n\n\*\*|$)/)?.[0]

        if (paymentSection) {
            console.log('\n📋 Section Paiement extraite:')
            console.log('---')
            console.log(paymentSection.substring(0, 500))
            console.log('---')
        } else {
            console.log('\n⚠️  Section paiement non trouvée dans le prompt')
        }

    } catch (e) {
        console.error('❌ Erreur:', e.message)
    }

    console.log('\n✅ Test terminé')
}

testPaymentMethodsInjection()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
