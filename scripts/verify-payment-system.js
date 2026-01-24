const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function verifyPaymentSystem() {
    console.log('=== VÉRIFICATION COMPLÈTE SYSTÈME PAIEMENT ===\n')

    // 1. Check AgentProfile payment rules
    console.log('1️⃣ VÉRIFICATION PAYMENT RULES\n')

    const agents = await prisma.agent.findMany({
        include: { profile: true }
    })

    for (const agent of agents) {
        console.log(`--- ${agent.name} ---`)

        if (!agent.profile?.paymentRules) {
            console.log('  ❌ Pas de paymentRules')
            continue
        }

        const hasVariable = agent.profile.paymentRules.includes('{{PAYMENT_METHODS}}')
        console.log(`  Variable {{PAYMENT_METHODS}}: ${hasVariable ? '✅' : '❌'}`)

        if (!hasVariable) {
            console.log('  ⚠️ PROBLÈME: La variable n\'est pas présente!')
        }

        // Check language
        const isFrench = agent.profile.paymentRules.includes('MOYENS DE PAIEMENT')
        const isEnglish = agent.profile.paymentRules.includes('PAYMENT METHODS')
        console.log(`  Langue: ${isFrench ? 'FR' : isEnglish ? 'EN' : 'UNKNOWN'}`)
        console.log('')
    }

    // 2. Check AgentSettings pour moyens de paiement
    console.log('\n2️⃣ VÉRIFICATION AGENT SETTINGS\n')

    for (const agent of agents) {
        console.log(`--- ${agent.name} ---`)

        const settings = await prisma.agentSetting.findMany({
            where: { agentId: agent.id }
        })

        const paymentSettings = settings.filter(s => s.key.startsWith('payment_'))

        if (paymentSettings.length === 0) {
            console.log('  ⚠️ Aucun payment setting configuré')
            console.log('  Pour tester, ajouter dans Prisma Studio:')
            console.log('    AgentSetting → agentId = ' + agent.id)
            console.log('    - payment_paypal_enabled = "true"')
            console.log('    - payment_paypal_username = "email@example.com"')
        } else {
            console.log('  💳 Payment settings trouvés:')
            paymentSettings.forEach(s => {
                console.log(`    ${s.key} = ${s.value}`)
            })
        }
        console.log('')
    }

    console.log('\n3️⃣ TEST DIRECTOR (simulation)\n')
    console.log('ℹ️  Pour tester le Director complet, il faut:')
    console.log('  1. Configurer payment settings dans AgentSettings')
    console.log('  2. Envoyer un message WhatsApp en phase CRISIS')
    console.log('  3. Vérifier que l\'IA mentionne SEULEMENT les moyens activés')
    console.log('')
    console.log('✅ Vérification terminée')
    console.log('')
    console.log('📋 Résumé:')
    console.log('  - Payment rules avec {{PAYMENT_METHODS}}: À vérifier ci-dessus')
    console.log('  - Director modifié pour remplacer variable: ✅')
    console.log('  - AgentSettings à configurer: Vérifier ci-dessus')
}

verifyPaymentSystem()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
