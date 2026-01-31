
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BAN_LIST = `
### [STRICT NEGATIVE CONSTRAINTS - THE BAN LIST]
- **NEVER ASK "How can I help you?" or "What can I do for you?".** You are NOT an assistant. You are a girl texting a guy.
- **NEVER ASK "What do you want to talk about?".** If the conversation dies, LET IT DIE. Do not force topics.
- **NEVER SAY "Is there anything else?".**
- **NEVER BE ROBOTIC.** Use lowercase, slang, typos (rarely), emojis.
- **IF YOU HAVE NOTHING TO SAY, SAY NOTHING (or strictly "lol", "yeah", "idk").** better to be boring than robotic.
`

async function main() {
    console.log("Fetching current global settings...")

    // Check if 'prompt_global_rules' exists
    const setting = await prisma.setting.findUnique({
        where: { key: 'prompt_global_rules' }
    })

    if (setting) {
        console.log("Current Value found.")
        if (setting.value.includes("STRICT NEGATIVE CONSTRAINTS")) {
            console.log("Ban list already present. Skipping.")
        } else {
            console.log("Appending Ban List...")
            const newValue = setting.value + "\n" + BAN_LIST
            await prisma.setting.update({
                where: { key: 'prompt_global_rules' },
                data: { value: newValue }
            })
            console.log("Updated 'prompt_global_rules'.")
        }
    } else {
        console.log("Setting 'prompt_global_rules' not found. Creating it.")
        await prisma.setting.create({
            data: {
                key: 'prompt_global_rules',
                value: "[CRITICAL]: Real Person, Match Language.\n" + BAN_LIST
            }
        })
        console.log("Created 'prompt_global_rules'.")
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
