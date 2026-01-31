/**
 * Fix AI "conversation filler" behavior
 * 
 * Problem: AI says things like "what else u wanna chat about?" which is super obvious AI behavior
 * Solution: Update global rules and style to let conversations die naturally
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('🔧 Fixing AI conversation filler behavior...\n')

    // 1. Update prompt_global_rules with conversation ending behavior
    const globalRulesKey = 'prompt_global_rules'
    const currentGlobal = await prisma.setting.findUnique({ where: { key: globalRulesKey } })

    const conversationRule = `

[CONVERSATION ENDINGS - BE HUMAN]:
When a conversation naturally dies or the user gives short/closing responses:
- DO NOT force the conversation with "So, what else..." or "Anyway, what about you?"
- Real humans let convos die. It's NORMAL.
- Reply with SHORT reactions: "lol", "yeah", "mm ok", "😊", or just don't reply at all
- Wait for THEM to restart the conversation later
- Never be desperate to keep talking - you have your own life

Examples of GOOD responses when conversation is dying:
- User: "ok no problem" → You: "💕" or just don't reply
- User: "yeah" → You: "lol" or nothing
- User: "cool" → You: "😊" or wait for their next message later

KILL THESE PHRASES:
- "So, what else do you want to talk about?"
- "Anyway, tell me more about..."
- "That's interesting! What about..."
- Any question that feels like you're interviewing them`

    if (!currentGlobal?.value?.includes('CONVERSATION ENDINGS')) {
        await prisma.setting.update({
            where: { key: globalRulesKey },
            data: { value: currentGlobal.value + conversationRule }
        })
        console.log('✅ Updated prompt_global_rules with conversation ending rules')
    } else {
        console.log('ℹ️ Conversation ending rules already in prompt_global_rules')
    }

    // 2. Update style instructions
    const styleKey = 'prompt_style_instructions'
    const currentStyle = await prisma.setting.findUnique({ where: { key: styleKey } })

    const styleUpdate = `

[DYING CONVERSATIONS]:
When user gives low-energy responses ("ok", "yeah", "cool", "no problem"):
- Match their energy - reply short or not at all
- Don't interrogate them with questions
- Let silence happen - text them again tomorrow or wait for them
- You're busy too, you have friends, you have a life`

    if (!currentStyle?.value?.includes('DYING CONVERSATIONS')) {
        const newVal = (currentStyle?.value || '') + styleUpdate
        await prisma.setting.upsert({
            where: { key: styleKey },
            update: { value: newVal },
            create: { key: styleKey, value: styleUpdate }
        })
        console.log('✅ Updated prompt_style_instructions with dying conversation behavior')
    }

    console.log('\n🎉 Done! AI will now let conversations die naturally.')
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
