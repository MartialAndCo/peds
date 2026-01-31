import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔧 FINAL FIX: Lena [PAYMENT_RECEIVED] Rule\n')

    const lena = await prisma.agent.findFirst({
        where: { name: 'Lena' },
        include: { profile: true }
    })

    if (!lena?.profile) {
        console.log('❌ Lena not found')
        return
    }

    // Ultra strict rule
    const lenaPaymentUltraStrict = `

### [PAYMENT_RECEIVED] - ULTRA STRICT - READ CAREFULLY
The tag [PAYMENT_RECEIVED] is FORBIDDEN unless the user has used PAST TENSE.

ASK YOURSELF: Did the user say "sent" or "done"?
- If NO → do NOT use [PAYMENT_RECEIVED]
- If YES → you can use [PAYMENT_RECEIVED]

EXAMPLES OF WHEN NOT TO USE [PAYMENT_RECEIVED]:
- "ill send you money" → NO (future)
- "im sending now" → NO (present)
- "i can help" → NO (offer)
- "how do i send?" → NO (question)

EXAMPLES OF WHEN TO USE [PAYMENT_RECEIVED]:
- "sent" → YES
- "done" → YES
- "just sent it" → YES
- "i sent it" → YES

If you're unsure, DON'T use the tag. Wait for clear confirmation.
`

    await prisma.agentProfile.update({
        where: { agentId: lena.id },
        data: {
            paymentRules: (lena.profile.paymentRules || '') + lenaPaymentUltraStrict
        }
    })

    console.log('✅ Lena payment rule ultra-strengthened')

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error('Error:', e)
    await prisma.$disconnect()
    process.exit(1)
})
