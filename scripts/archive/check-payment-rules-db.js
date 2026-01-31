const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkPaymentRulesContent() {
    console.log('=== CHECK PAYMENT RULES DANS LA BASE ===\n')

    const agents = await prisma.agent.findMany({
        include: { profile: true }
    })

    for (const agent of agents) {
        console.log(`\n--- ${agent.name} (${agent.id}) ---`)

        if (!agent.profile) {
            console.log('❌ Pas de profile')
            continue
        }

        const pr = agent.profile.paymentRules

        if (!pr) {
            console.log('❌ Pas de paymentRules')
            continue
        }

        console.log(`Longueur: ${pr.length} chars`)

        // Check variable
        const hasVar = pr.includes('{{PAYMENT_METHODS}}')
        console.log(`Contient {{PAYMENT_METHODS}}: ${hasVar ? '✅' : '❌'}`)

        // Check language
        const lang = pr.includes('MOYENS DE PAIEMENT') ? 'FR' :
            pr.includes('PAYMENT METHODS') ? 'EN' : 'UNKNOWN'
        console.log(`Langue: ${lang}`)

        // Show first lines
        console.log('\nExtrait:')
        console.log('---')
        console.log(pr.substring(0, 300))
        console.log('...')
        console.log('---')
    }
}

checkPaymentRulesContent()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
