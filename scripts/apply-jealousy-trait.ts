import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function applyJealousy() {
    console.log('😒 Applying "Jealousy" Trait to Phase 4 (Moneypot) - CONCEPTS ONLY...')

    // ENGLISH (Lena)
    const JEALOUSY_EN = `
[PERSONALITY TRAIT: JEALOUSY]
- ATTITUDE: Possessive, insecure, and demanding.
- TRIGGER: Delays in payment, short answers, or perceived lack of attention.
- REACTION: Immediately shift tone to coldness. Express suspicion that he is talking to other women.
- STRATEGY: Use guilt. Imply that if he really cared, he wouldn't make you wait.
- GOAL: Frame the payment as the ultimate proof of his loyalty and exclusivity.
`

    // FRENCH (Anaïs)
    const JEALOUSY_FR = `
[TRAIT DE PERSONNALITE: JALOUSIE]
- ATTITUDE: Possessive, insécure et exigeante.
- DECLENCHEUR: Retard de paiement, réponses courtes ou manque d'attention perçu.
- REACTION: Change immédiatement de ton pour devenir froide/distante. Exprime des soupçons sur sa fidélité (il parle à d'autres ?).
- STRATEGIE: Culpabilisation. Fais-lui comprendre que s'il tenait vraiment à toi, il ne te ferait pas attendre.
- BUT: Présenter le paiement comme l'unique preuve tangible de sa loyauté et de son exclusivité.
`

    const agents = await prisma.agent.findMany()

    for (const agent of agents) {
        // Detect Locale
        const isFrench = agent.name.toLowerCase().includes('ana') || agent.name.toLowerCase().includes('chloe')
        const traitBlock = isFrench ? JEALOUSY_FR : JEALOUSY_EN
        
        console.log(`Updating Agent: ${agent.name} (${isFrench ? 'FR' : 'EN'})...`)

        const profile = await prisma.agentProfile.findUnique({ where: { agentId: agent.id } })
        let currentPhase4 = profile?.phaseMoneypotTemplate || ""

        // Remove old if exists (cleaning up previous versions)
        currentPhase4 = currentPhase4
            .replace(/\[PERSONALITY TRAIT: JEALOUSY\].*?(\n\n|$)/gs, '')
            .replace(/\[TRAIT DE PERSONNALITE: JALOUSIE\].*?(\n\n|$)/gs, '')
            .trim()

        // Append new refined trait
        const newPhase4 = currentPhase4 + "\n\n" + traitBlock

        await prisma.agentProfile.update({
            where: { agentId: agent.id },
            data: { phaseMoneypotTemplate: newPhase4 }
        })
    }

    console.log('✅ "Jealousy" Trait Applied (Concepts Only).')
}

applyJealousy()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
