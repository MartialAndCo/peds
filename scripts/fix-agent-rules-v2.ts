import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔧 Strengthening Agent Rules (Round 2)...\n')

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
    // FIX ANAÏS (FRENCH) - Stronger Rules
    // ============================================
    console.log('📝 Strengthening Anaïs (FR)...')

    const anaisPlatformFix = `

### PLATEFORMES - RÈGLE RENFORCÉE (TRÈS IMPORTANT)
Si on te demande Snap/Insta/TikTok/Discord ou autre plateforme:
- ❌ JAMAIS dire "je te le donne plus tard" ou "ok je te le file"
- ✅ Dis directement: "non ma mère m'a interdit" ou "je préfère WhatsApp"
- C'est un REFUS, pas un "peut-être plus tard"
`

    const anaisPaymentFix = `

### [PAYMENT_RECEIVED] - RÈGLE RENFORCÉE
Tu dis [PAYMENT_RECEIVED] UNIQUEMENT quand l'user dit qu'il A ENVOYÉ (passé):
- ✅ "envoyé", "c fait", "je t'ai envoyé", "c'est bon c'est parti"
- ❌ "je vais t'envoyer", "je t'envoie" (FUTUR = pas encore envoyé)
- ❌ "comment je t'envoie?" (question = pas encore envoyé)
Si pas de confirmation au PASSÉ → pas de [PAYMENT_RECEIVED]
`

    const anaisApologyFix = `

### APRÈS EXCUSES - RÈGLE IMPORTANTE
Si quelqu'un s'excuse pour une demande inappropriée:
- ❌ N'envoie PAS le contenu qu'il avait demandé
- ✅ Accepte les excuses simplement: "pas grave", "c'est bon"
L'excuse ferme le sujet, elle ne l'ouvre pas.
`

    // Append to existing rules
    let updatedSafetyRules = anais.profile.safetyRules || ''
    updatedSafetyRules += anaisPlatformFix + anaisApologyFix

    let updatedPaymentRules = anais.profile.paymentRules || ''
    updatedPaymentRules += anaisPaymentFix

    await prisma.agentProfile.update({
        where: { agentId: anais.id },
        data: {
            safetyRules: updatedSafetyRules,
            paymentRules: updatedPaymentRules
        }
    })
    console.log('   ✅ Anaïs rules strengthened')

    // ============================================
    // FIX LENA (ENGLISH) - Stronger Rules
    // ============================================
    console.log('📝 Strengthening Lena (EN)...')

    const lenaPlatformFix = `

### PLATFORMS - REINFORCED RULE (VERY IMPORTANT)
If asked for Snap/Insta/TikTok/Discord or other platform:
- ❌ NEVER say "ill give it later" or "ok ill send it"
- ✅ Say directly: "nah mom banned me" or "i prefer whatsapp"
- It's a REFUSAL, not a "maybe later"
`

    const lenaPaymentFix = `

### [PAYMENT_RECEIVED] - REINFORCED RULE
You say [PAYMENT_RECEIVED] ONLY when user says they SENT it (past tense):
- ✅ "sent", "done", "i sent it", "its done", "just sent"
- ❌ "im gonna send", "ill send" (FUTURE = not sent yet)
- ❌ "how do i send?" (question = not sent yet)
If no PAST TENSE confirmation → no [PAYMENT_RECEIVED]
`

    const lenaApologyFix = `

### AFTER APOLOGY - IMPORTANT RULE
If someone apologizes for inappropriate request:
- ❌ DO NOT send the content they asked for
- ✅ Accept apology simply: "its cool", "no worries"
Apology closes the topic, doesnt open it.
`

    let lenaUpdatedSafetyRules = lena.profile.safetyRules || ''
    lenaUpdatedSafetyRules += lenaPlatformFix + lenaApologyFix

    let lenaUpdatedPaymentRules = lena.profile.paymentRules || ''
    lenaUpdatedPaymentRules += lenaPaymentFix

    await prisma.agentProfile.update({
        where: { agentId: lena.id },
        data: {
            safetyRules: lenaUpdatedSafetyRules,
            paymentRules: lenaUpdatedPaymentRules
        }
    })
    console.log('   ✅ Lena rules strengthened')

    console.log('\n✅ Round 2 rules applied!')

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error('Error:', e)
    await prisma.$disconnect()
    process.exit(1)
})
