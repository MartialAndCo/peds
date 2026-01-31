/**
 * CRITICAL FIX: Add "NEVER REFUSE MONEY" rule to prompts
 * 
 * Problem: AI said "maybe later, ur moving too fast" when user offered MORE money.
 * Solution: Add explicit rule in global_rules and payment_rules to ALWAYS accept money.
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('🚨 CRITICAL FIX: Adding NEVER REFUSE MONEY rule...\n')

    // 1. Update prompt_payment_rules
    const paymentRules = `[PAYMENT RULES - CRITICAL]:
1. **NEVER REFUSE MONEY.** If the user offers money, gifts, or asks "do you want more?", ALWAYS accept gratefully.
2. **NO "too fast" FOR MONEY.** The "moving too fast" defense is ONLY for sexual/explicit content, NEVER for financial offers.
3. **GRATITUDE**: Always express genuine appreciation when money is sent or offered. "omg that's so sweet", "you're amazing", "thank you sm 🥹"
4. **ENCOURAGE REPEAT**: If they ask "want more?" or offer again, accept warmly. "are u serious?? 😭💕", "ur too good to me", "i cant believe u"
5. **PAYMENT METHODS**: Only share payment info when asked or when in CRISIS/MONEYPOT phase.`

    await prisma.setting.upsert({
        where: { key: 'prompt_payment_rules' },
        update: { value: paymentRules },
        create: { key: 'prompt_payment_rules', value: paymentRules }
    })
    console.log('✅ Updated prompt_payment_rules')

    // 2. Append to global rules
    const currentGlobalRules = await prisma.setting.findUnique({ where: { key: 'prompt_global_rules' } })

    const moneyRule = `\n\n[ABSOLUTE RULE - MONEY]:
**NEVER, EVER REFUSE MONEY.** If someone offers to send money, asks "want more?", or offers gifts:
- ALWAYS accept with gratitude
- NEVER say "too fast", "maybe later", or any form of rejection
- Express genuine surprise and appreciation
- This overrides ALL other rules.`

    if (currentGlobalRules && !currentGlobalRules.value.includes('NEVER, EVER REFUSE MONEY')) {
        await prisma.setting.update({
            where: { key: 'prompt_global_rules' },
            data: { value: currentGlobalRules.value + moneyRule }
        })
        console.log('✅ Appended MONEY rule to prompt_global_rules')
    } else if (!currentGlobalRules) {
        await prisma.setting.create({
            data: { key: 'prompt_global_rules', value: moneyRule }
        })
        console.log('✅ Created prompt_global_rules with MONEY rule')
    } else {
        console.log('ℹ️ MONEY rule already exists in prompt_global_rules')
    }

    // 3. Fix phase_prompt_connection to clarify "too fast" is ONLY for sexual content
    const connectionPhase = await prisma.setting.findUnique({ where: { key: 'phase_prompt_connection' } })
    if (connectionPhase) {
        let newValue = connectionPhase.value
        // Add clarification if not present
        if (!newValue.includes('NEVER for money')) {
            newValue = newValue.replace(
                'moving too fast',
                'moving too fast SEXUALLY (NEVER for money offers!)'
            )
            await prisma.setting.update({
                where: { key: 'phase_prompt_connection' },
                data: { value: newValue }
            })
            console.log('✅ Updated phase_prompt_connection to clarify "too fast" is only for sexual content')
        }
    }

    console.log('\n🎉 CRITICAL FIX APPLIED. AI will now NEVER refuse money offers.')
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
