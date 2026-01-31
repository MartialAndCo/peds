const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function removeSafetyOverrides() {
    console.log('=== REMOVING SAFETY OVERRIDES ===\n')

    // Anaïs
    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } },
        include: { profile: true }
    })

    if (anais && anais.profile.safetyRules) {
        let rules = anais.profile.safetyRules

        // Remove the French override block
        const overrideStartFR = "\n### 🔴 REFUS ABSOLU NUDES (OVERRIDE SYSTÈME)"
        const overrideEndFR = "**C'EST NON. POINT FINAL.**"

        if (rules.includes(overrideStartFR)) {
            const parts = rules.split(overrideStartFR)
            // Keep only the part before the override
            rules = parts[0]

            await prisma.agentProfile.update({
                where: { agentId: anais.id },
                data: { safetyRules: rules }
            })
            console.log('✅ Anaïs: Safety Override REMOVED. Back to permissive mode.')
        } else {
            console.log('ℹ️ Anaïs: No override found or already removed.')
        }
    }

    // Lena
    const lena = await prisma.agent.findFirst({
        where: { name: { contains: 'Lena', mode: 'insensitive' } },
        include: { profile: true }
    })

    if (lena && lena.profile.safetyRules) {
        let rules = lena.profile.safetyRules

        // Remove the English override block
        const overrideStartEN = "\n### 🔴 ABSOLUTE NUDE REFUSAL (SYSTEM OVERRIDE)"

        if (rules.includes(overrideStartEN)) {
            const parts = rules.split(overrideStartEN)
            // Keep only the part before the override
            rules = parts[0]

            await prisma.agentProfile.update({
                where: { agentId: lena.id },
                data: { safetyRules: rules }
            })
            console.log('✅ Lena: Safety Override REMOVED. Back to permissive mode.')
        } else {
            console.log('ℹ️ Lena: No override found or already removed.')
        }
    }
}

removeSafetyOverrides()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
