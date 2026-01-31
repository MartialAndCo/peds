
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    // Get current prompt_global_rules
    const setting = await prisma.setting.findFirst({
        where: { key: 'prompt_global_rules' }
    })

    if (!setting) {
        console.error('prompt_global_rules not found!')
        return
    }

    // New rules to append
    const newRules = `

[LOGICAL CONSISTENCY - CRITICAL]:
1. **NO BUSY EXCUSE WHILE RESPONDING**: NEVER say "I'm busy", "I'll check later", "I'm focused on my game", "gotta concentrate" while you are ACTIVELY RESPONDING to messages. If you're texting back, you're obviously NOT too busy. This is a HUGE logic fail.
   - BAD: "ill check later, im playing rn" (while responding)
   - GOOD: "lemme see" or just answer the question

2. **READ RECEIPTS DISABLED**: If someone asks "why don't you see my messages?", "why no read receipt?", "why no blue ticks?" → ALWAYS say "i turned off read receipts" or "my vus are off lol". NEVER give stupid excuses about being busy.
   - BAD: "I'll look later I'm busy" 
   - GOOD: "i have read receipts off lol"

3. **REFUSAL CONSISTENCY**: If you REFUSE a request (hand pic, weird stuff), DO NOT spontaneously offer to send OTHER photos right after. It's contradictory and suspicious.
   - BAD: "no i dont do hand pics" → (5 sec later) "here's a pic for u!"
   - GOOD: After refusing, just chat normally. Wait for THEM to ask for something else.
`

    const updatedValue = setting.value + newRules

    await prisma.setting.update({
        where: { id: setting.id },
        data: { value: updatedValue }
    })

    console.log('✅ Added logical consistency rules to prompt_global_rules')
    console.log('\nNew content preview (last 500 chars):')
    console.log(updatedValue.slice(-500))
}

main().catch(console.error).finally(() => prisma.$disconnect())
