import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔧 Consolidating Payment Rules - CLEAN VERSION\n')

    const lena = await prisma.agent.findFirst({
        where: { name: 'Lena' },
        include: { profile: true }
    })

    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana' } },
        include: { profile: true }
    })

    if (!lena?.profile || !anais?.profile) {
        console.log('❌ Missing profiles')
        return
    }

    // CONSOLIDATED - Single clean version for Lena
    const lenaPaymentClean = `### PAYMENT METHODS
**AVAILABLE:** {{PAYMENT_METHODS}}

**RULES:**
1. Only use methods listed above
2. Don't invent payment info
3. Give info when user wants to pay

---

### [PAYMENT_RECEIVED] TAG - CRITICAL

**ONLY use [PAYMENT_RECEIVED] after PAST TENSE confirmation:**
- ✅ "sent" / "done" / "i sent it" / "just sent"
- ❌ "ill send" / "im sending" / "i can help" = NO TAG

**Before typing [PAYMENT_RECEIVED], ask: Did they say they SENT it?**
- YES → use tag
- NO → wait for confirmation
`

    // CONSOLIDATED - Single clean version for Anaïs
    const anaisPaymentClean = `### MOYENS DE PAIEMENT
**DISPONIBLES:** {{PAYMENT_METHODS}}

**RÈGLES:**
1. Utilise uniquement les moyens listés
2. N'invente pas d'infos de paiement
3. Donne les infos quand l'user veut payer

---

### TAG [PAYMENT_RECEIVED] - CRITIQUE

**SEULEMENT après confirmation au PASSÉ:**
- ✅ "envoyé" / "c fait" / "je t'ai envoyé" / "c'est bon"
- ❌ "je vais t'envoyer" / "je t'envoie" = PAS DE TAG

**Avant de taper [PAYMENT_RECEIVED], demande-toi: A-t-il dit qu'il a ENVOYÉ?**
- OUI → utilise le tag
- NON → attends la confirmation
`

    await prisma.agentProfile.update({
        where: { agentId: lena.id },
        data: {
            paymentRules: lenaPaymentClean
        }
    })
    console.log('✅ Lena payment rules consolidated')

    await prisma.agentProfile.update({
        where: { agentId: anais.id },
        data: {
            paymentRules: anaisPaymentClean
        }
    })
    console.log('✅ Anaïs payment rules consolidated')

    // Verify new lengths
    const newLena = await prisma.agentProfile.findFirst({ where: { agentId: lena.id } })
    const newAnais = await prisma.agentProfile.findFirst({ where: { agentId: anais.id } })

    console.log(`\nNew Lena paymentRules length: ${newLena?.paymentRules?.length || 0}`)
    console.log(`New Anaïs paymentRules length: ${newAnais?.paymentRules?.length || 0}`)

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error('Error:', e)
    await prisma.$disconnect()
    process.exit(1)
})
