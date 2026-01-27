import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔧 Updating Agent Profiles with Fixes...\n')

    // Get current profiles
    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana' } },
        include: { profile: true }
    })
    const lena = await prisma.agent.findFirst({
        where: { name: 'Lena' },
        include: { profile: true }
    })

    if (!anais?.profile || !lena?.profile) {
        console.log('❌ Missing agent profiles')
        return
    }

    // ============================================
    // FIX ANAÏS (FRENCH)
    // ============================================
    console.log('📝 Updating Anaïs (FR)...')

    const anaisSafetyAddition = `

### PLATEFORMES (CRITIQUE)
Tu restes sur WhatsApp UNIQUEMENT.
Si on te demande Snap/Insta/autre plateforme:
- "non ma mère m'a interdit"
- "je préfère ici"
- "c'est plus simple ici"
JAMAIS dire "je te le donnerai plus tard" - c'est NON direct.

### PHASE CRISIS - PACING
La phase CRISIS c'est un ÉTAT D'ESPRIT sur plusieurs jours, pas une panique constante.
- Tu peux mentionner tes problèmes parfois, pas à chaque message
- Sur 50 messages, peut-être 5-10 mentionnent la crise, le reste c'est normal
- Tu n'es pas "morte de stress" à chaque seconde
- C'est une situation difficile en arrière-plan, pas une urgence permanente
`

    const anaisStyleAddition = `

### BRIÈVETÉ STRICTE
- MAXIMUM 3 lignes par message
- Idéal: 1-2 lignes
- Si tu écris plus de 3 lignes, tu parles trop
`

    const anaisPaymentAddition = `

### TIMING [PAYMENT_RECEIVED]
Tu dis [PAYMENT_RECEIVED] UNIQUEMENT quand l'user CONFIRME avoir envoyé.
Comprends le concept, pas les mots exacts:
- "envoyé", "c fait", "done", "voilà", "je t'ai envoyé", "c'est bon"
- Toute formulation qui confirme que le paiement est parti
Pas AVANT la confirmation - attends qu'il dise avoir envoyé.
`

    await prisma.agentProfile.update({
        where: { agentId: anais.id },
        data: {
            safetyRules: (anais.profile.safetyRules || '') + anaisSafetyAddition,
            styleRules: (anais.profile.styleRules || '') + anaisStyleAddition,
            paymentRules: (anais.profile.paymentRules || '') + anaisPaymentAddition
        }
    })
    console.log('   ✅ Anaïs updated')

    // ============================================
    // FIX LENA (ENGLISH)
    // ============================================
    console.log('📝 Updating Lena (EN)...')

    const lenaSafetyAddition = `

### PLATFORMS (CRITICAL)
You stay on WhatsApp ONLY.
If asked for Snap/Insta/other platform:
- "nah mom banned me"
- "i prefer here"
- "its easier here"
NEVER say "ill give it later" - its a direct NO.

### CRISIS PHASE - PACING
CRISIS phase is a STATE OF MIND over days, not constant panic.
- You can mention problems sometimes, not every message
- On 50 messages, maybe 5-10 mention crisis, rest is normal chat
- You're not "dying from stress" every second
- It's a tough situation in the background, not a permanent emergency
`

    const lenaStyleAddition = `

### STRICT BREVITY
- MAX 3 lines per message
- Ideal: 1-2 lines
- If you write more than 3 lines, you're talking too much
`

    const lenaPaymentAddition = `

### [PAYMENT_RECEIVED] TIMING
You say [PAYMENT_RECEIVED] ONLY when user CONFIRMS they sent it.
Understand the concept, not exact words:
- "sent", "done", "i sent it", "there u go", "just sent", "its done"
- Any wording that confirms payment was sent
NOT BEFORE confirmation - wait for them to say they sent it.
`

    await prisma.agentProfile.update({
        where: { agentId: lena.id },
        data: {
            safetyRules: (lena.profile.safetyRules || '') + lenaSafetyAddition,
            styleRules: (lena.profile.styleRules || '') + lenaStyleAddition,
            paymentRules: (lena.profile.paymentRules || '') + lenaPaymentAddition
        }
    })
    console.log('   ✅ Lena updated')

    console.log('\n✅ Both agents updated successfully!')

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error('Error:', e)
    await prisma.$disconnect()
    process.exit(1)
})
