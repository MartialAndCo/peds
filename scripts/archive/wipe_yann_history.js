const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- WIPING HISTORY FOR YANN (To Fix Style Bleed) ---')
    const phone = '+33695472237'

    const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: phone } })
    if (!contact) {
        console.log('Contact Yann not found.')
        return
    }

    const conversations = await prisma.conversation.findMany({ where: { contactId: contact.id } })

    for (const c of conversations) {
        // Delete messages
        const deleted = await prisma.message.deleteMany({ where: { conversationId: c.id } })
        console.log(`Deleted ${deleted.count} messages from Conv ${c.id}`)

        // Disable Mem0 context for a bit? No, Mem0 might also hold "bad" memories.
        // I won't purge Mem0 yet, but if this fails, I will.
    }

    console.log('✅ History Wiped. Next message should use V5 Prompt cleanly.')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
