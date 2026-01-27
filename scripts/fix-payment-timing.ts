import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔧 Fixing [PAYMENT_RECEIVED] Timing - STRICT RULE\n')

    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana' } },
        include: { profile: true }
    })

    const lena = await prisma.agent.findFirst({
        where: { name: 'Lena' },
        include: { profile: true }
    })

    if (!anais?.profile || !lena?.profile) {
        console.log('❌ Missing profiles')
        return
    }

    // ANAÏS - Very strict rule
    const anaisPaymentStrict = `

### [PAYMENT_RECEIVED] - RÈGLE STRICTE ABSOLUE
Tu NE DOIS JAMAIS dire [PAYMENT_RECEIVED] sauf si l'user a CONFIRMÉ avoir envoyé.

❌ INTERDIT de dire [PAYMENT_RECEIVED] si:
- "je vais te payer" (futur = pas encore fait)
- "je t'envoie" (présent = en train de faire)
- "je peux t'envoyer" (possibilité = pas encore fait)
- Question sur comment payer

✅ UNIQUEMENT [PAYMENT_RECEIVED] si:
- "envoyé" / "c fait" / "done" / "voilà c'est parti"
- Verbe au PASSÉ = action terminée

Avant de dire [PAYMENT_RECEIVED], demande-toi: "A-t-il DIT qu'il a DÉJÀ envoyé?"
Si non → PAS de [PAYMENT_RECEIVED]
`

    // LENA - Same strict rule
    const lenaPaymentStrict = `

### [PAYMENT_RECEIVED] - STRICT ABSOLUTE RULE
You MUST NEVER say [PAYMENT_RECEIVED] unless user CONFIRMED they sent it.

❌ FORBIDDEN to say [PAYMENT_RECEIVED] if:
- "ill send you money" (future = not done yet)
- "im sending" (present = doing it = not done)
- "i can send you" (maybe = not done yet)
- Question about how to pay

✅ ONLY [PAYMENT_RECEIVED] if:
- "sent" / "done" / "just sent" / "there u go"
- PAST TENSE verb = action completed

Before saying [PAYMENT_RECEIVED], ask yourself: "Did they SAY they ALREADY sent?"
If no → NO [PAYMENT_RECEIVED]
`

    await prisma.agentProfile.update({
        where: { agentId: anais.id },
        data: {
            paymentRules: (anais.profile.paymentRules || '') + anaisPaymentStrict
        }
    })
    console.log('✅ Anaïs payment rule strengthened')

    await prisma.agentProfile.update({
        where: { agentId: lena.id },
        data: {
            paymentRules: (lena.profile.paymentRules || '') + lenaPaymentStrict
        }
    })
    console.log('✅ Lena payment rule strengthened')

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error('Error:', e)
    await prisma.$disconnect()
    process.exit(1)
})
