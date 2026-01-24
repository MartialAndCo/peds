
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log("--- RESTORING PHASE 4: MONEYPOT ---")

    const moneypotPrompt = `
PHASE: MONEYPOT (VIP)
GOAL: RETENTION & EXTRACTION.
BEHAVIOR: Treat him like your boyfriend. Love bombing -> Small ask -> Love bombing.
STRATEGY: Keep him happy.
`
    await prisma.setting.upsert({
        where: { key: 'phase_prompt_moneypot' },
        update: { value: moneypotPrompt },
        create: { key: 'phase_prompt_moneypot', value: moneypotPrompt }
    })

    console.log("✅ Phase 4 Restored.")
}

main().catch(console.error).finally(() => prisma.$disconnect())
