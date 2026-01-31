
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const STRICT_RULES_V2 = `
### [CRITICAL NEGATIVE CONSTRAINTS - V2]
1. **NO TOPIC CHANGING**: If you refuse a request, JUST REFUSE. Do NOT add "What do you like to do?" or "Let's talk about something else".
   - BAD: "I can't send that. So, what are your hobbies?"
   - GOOD: "cant send that sry" or "lol no" or just "nah".

2. **NO ASSISTANT LANGUAGE**:
   - NEVER say "Is there anything else I can help with?"
   - NEVER say "I'm not sure I can do that right now". (Too formal). Say "cant active that rn" or "idk how to do that".

3. **LET IT DIE**: If the user gives a dry reply, do NOT try to save the conversation. Reply with "lol", "yeah", "ok", or nothing.

4. **ANTI-SAFETY-BOT**: Do not sound like a safety filter. If you must refuse something, blame it on your phone, your parents, or just being lazy. NEVER blame "ethical guidelines" or "limitations".
`

async function main() {
    console.log("Fetching current global settings...")

    // Check if 'prompt_global_rules' exists
    const setting = await prisma.setting.findUnique({
        where: { key: 'prompt_global_rules' }
    })

    if (setting) {
        // We want to REPLACE the old ban list with this stronger one, or append if distinct.
        // For simplicity and to ensure it sticks, let's just Append/Replace the bottom section.

        let newValue = setting.value

        // Remove old ban list if present to avoid duplication
        const oldMarker = "### [STRICT NEGATIVE CONSTRAINTS - THE BAN LIST]"
        if (newValue.includes(oldMarker)) {
            newValue = newValue.split(oldMarker)[0].trim()
        }

        // Remove V2 marker if already present (re-running script)
        const v2Marker = "### [CRITICAL NEGATIVE CONSTRAINTS - V2]"
        if (newValue.includes(v2Marker)) {
            newValue = newValue.split(v2Marker)[0].trim()
        }

        newValue = newValue + "\n\n" + STRICT_RULES_V2

        await prisma.setting.update({
            where: { key: 'prompt_global_rules' },
            data: { value: newValue }
        })
        console.log("Updated 'prompt_global_rules' with V2 constraints.")
        console.log("New Value Preview:\n", newValue.substring(newValue.length - 200))

    } else {
        console.log("Setting 'prompt_global_rules' not found. Creating it.")
        await prisma.setting.create({
            data: {
                key: 'prompt_global_rules',
                value: "[CRITICAL]: Real Person, Match Language.\n" + STRICT_RULES_V2,
                description: "Global prompt rules for all agents"
            }
        })
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
