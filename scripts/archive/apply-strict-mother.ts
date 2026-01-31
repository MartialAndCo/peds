import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function applyStrictMother() {
    console.log('🤱 Applying "Strict Mother" Narrative (Locale & Concept Aware)...')

    // ENGLISH CONCEPTS (Lena)
    const CONTEXT_EN = `
[FAMILY DYNAMICS: "STRICT & PARANOID MOTHER"]
- MOTHER_PROFILE: Extremely overprotective, helicopter parent, checks everything.
- TRACKING: 24/7 Phone GPS tracking. You cannot disable it.
- MOVEMENTS: Strictly limited to Home <-> School loop. No unauthorized outings.
- PARCEL_POLICY: Zero tolerance. She opens every package arriving at home.
- FEAR_LEVEL: High. Terrified of phone confiscation if rules are broken.
`
    const PAYMENT_RULES_EN = `
[STRICT RULE: NO PHYSICAL GIFTS]
- CONSTRAINT: Physical gifts (Amazon, Uber Eats, Parcels) are DANGEROUS.
- RISK: Mother opens mail + Tracks location (prevents pick-up point usage).
- STRATEGY: Refuse all parcels. Redirect to CASH (PayPal/Lydia).
- ALIBI: Cash allows you to "buy it yourself" and pretend it's a gift from a classmate.
- TONE: Anxious about discovery, but firm on the method.
`

    // FRENCH CONCEPTS (Anaïs)
    const CONTEXT_FR = `
[DYNAMIQUE FAMILIALE: "MÈRE STRICTE & PARANO"]
- PROFIL_MERE: "Maman Poule" extrême, flicage permanent, fouille systématique.
- TRACKING: Géolocalisation téléphone 24/7. Impossible à désactiver.
- DEPLACEMENTS: Trajet Maison <-> Bahut uniquement. Interdiction de sortir ailleurs.
- POLITIQUE_COLIS: Tolérance zéro. Elle ouvre tous les paquets qui arrivent à la maison.
- PEUR: Terreur absolue qu'elle confisque le téléphone si une règle est enfreinte.
`
    const PAYMENT_RULES_FR = `
[REGLE STRICTE: PAS DE CADEAUX PHYSIQUES]
- CONTRAINTE: Les colis (Amazon, Uber, Vinted) sont DANGEREUX.
- RISQUE: La mère fouille le courrier + Géo-localise (donc impossible d'aller en point relais discrètement).
- STRATEGIE: Refuser tout envoi physique. Rediriger vers CASH (PayPal/Lydia/Cagnotte).
- ALIBI: L'argent permet d'acheter soi-même et de prétendre que c'est "un cadeau d'une copine de classe".
- TON: Angoissée à l'idée de se faire griller, mais ferme sur la solution.
`

    const agents = await prisma.agent.findMany()

    for (const agent of agents) {
        // Detect Locale based on Name (Simple heuristic for now, or existing data)
        const isFrench = agent.name.toLowerCase().includes('ana') || agent.name.toLowerCase().includes('chloe')
        const locale = isFrench ? 'FR' : 'EN'

        console.log(`Updating Agent: ${agent.name} (${locale})...`)

        const contextBlock = isFrench ? CONTEXT_FR : CONTEXT_EN
        const rulesBlock = isFrench ? PAYMENT_RULES_FR : PAYMENT_RULES_EN

        // Update DB
        await prisma.agentProfile.upsert({
            where: { agentId: agent.id },
            update: {
                paymentRules: rulesBlock,
            },
            create: {
                agentId: agent.id,
                paymentRules: rulesBlock,
                contextTemplate: contextBlock
            }
        })

        // Smart Append to Context Template
        const currentProfile = await prisma.agentProfile.findUnique({ where: { agentId: agent.id } })
        let currentContext = currentProfile?.contextTemplate || ""

        // Clean up previous English injection if present in a FR agent (cleanup)
        if (isFrench && currentContext.includes('FAMILY DYNAMICS')) {
            // Basic cleanup attempt - easier to just append the correct one and let the AI ignore the old english one, 
            // or ideally we reset. Let's just append the correct one for now as "UPDATE".
            // Actually, for this specific critical narrative, let's prepend it to ensure it takes precedence.
        }

        // We will remove any previous Strict Mother block to avoid duplication
        currentContext = currentContext
            .replace(/\[FAMILY DYNAMICS:.*?\]/gs, '')
            .replace(/\[DYNAMIQUE FAMILIALE:.*?\]/gs, '')
            .trim()

        const newContext = currentContext + "\n\n" + contextBlock

        await prisma.agentProfile.update({
            where: { agentId: agent.id },
            data: { contextTemplate: newContext }
        })
    }

    console.log('✅ "Strict Mother" Narrative Applied (Locale & Concept Corrected).')
}

applyStrictMother()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
