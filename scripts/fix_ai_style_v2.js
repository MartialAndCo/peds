/**
 * CRITICAL FIXES:
 * 1. Verify NEVER REFUSE MONEY rule is in DB
 * 2. Add anti-AI-filler rule to stop "what else u wanna chat about" behavior
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('🔍 Checking current prompt values...\n')

    // 1. Check if NEVER REFUSE MONEY exists
    const globalRules = await prisma.setting.findUnique({ where: { key: 'prompt_global_rules' } })
    const paymentRules = await prisma.setting.findUnique({ where: { key: 'prompt_payment_rules' } })
    const connectionPhase = await prisma.setting.findUnique({ where: { key: 'phase_prompt_connection' } })

    console.log('=== prompt_global_rules ===')
    console.log(globalRules?.value?.includes('NEVER, EVER REFUSE MONEY') ? '✅ Has MONEY rule' : '❌ Missing MONEY rule')

    console.log('\n=== prompt_payment_rules ===')
    console.log(paymentRules?.value?.includes('NEVER REFUSE MONEY') ? '✅ Has MONEY rule' : '❌ Missing MONEY rule')

    console.log('\n=== phase_prompt_connection ===')
    console.log(connectionPhase?.value?.includes('NEVER for money') ? '✅ Clarified' : '❌ Not clarified')

    // 2. Add anti-filler rule to style instructions
    console.log('\n📝 Adding anti-AI-filler rules...')

    const styleKey = 'prompt_style_instructions'
    const currentStyle = await prisma.setting.findUnique({ where: { key: styleKey } })

    const antiFiller = `
[CRITICAL - AVOID AI-SOUNDING PHRASES]:
NEVER use these filler phrases that scream "I'm an AI":
- "What else u wanna chat about?" ❌
- "So, tell me more about..." ❌
- "That's interesting! So..." ❌
- "Anyway, what about you?" ❌

Instead, be NATURAL:
- Sometimes just react without asking questions
- Let conversations die naturally - real people don't force convos
- If the vibe is off, just say short things like "lol k", "yeah", "mm"
- Only ask questions when genuinely curious

MONEY OFFERS:
If someone offers money again after you thanked them: 
- "wait fr? 😭" 
- "omg stoppp ur too nice"
- "i- 🥹"
NEVER say "maybe later" or "too fast" for MONEY.`

    if (!currentStyle?.value?.includes('AVOID AI-SOUNDING PHRASES')) {
        const newValue = (currentStyle?.value || '') + antiFiller
        await prisma.setting.upsert({
            where: { key: styleKey },
            update: { value: newValue },
            create: { key: styleKey, value: antiFiller }
        })
        console.log('✅ Added anti-AI-filler rules to prompt_style_instructions')
    } else {
        console.log('ℹ️ Anti-filler rules already exist')
    }

    // 3. Force update phase_prompt_connection if still wrong
    if (connectionPhase && !connectionPhase.value.includes('NEVER for money')) {
        let newVal = connectionPhase.value
        // Replace ALL instances of "too fast" context
        if (newVal.includes('moves too fast')) {
            newVal = newVal.replace(/moves too fast/gi, 'moves too fast SEXUALLY (NEVER for money!)')
        }
        if (newVal.includes('moving too fast')) {
            newVal = newVal.replace(/moving too fast/gi, 'moving too fast SEXUALLY (NEVER for money offers!)')
        }
        // Add explicit money rule if not present
        if (!newVal.includes('MONEY OFFERS')) {
            newVal += '\n\n[CRITICAL]: If user offers MONEY, ALWAYS accept gratefully. NEVER say "too fast" or "maybe later" for money.'
        }
        await prisma.setting.update({
            where: { key: 'phase_prompt_connection' },
            data: { value: newVal }
        })
        console.log('✅ Fixed phase_prompt_connection')
    }

    console.log('\n🎉 Done! Prompts updated.')
    console.log('⚠️ Note: The app may cache settings. Restart the Next.js app to apply.')
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
