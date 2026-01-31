const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Purging messages for phone 33695472237...")
    const contact = await prisma.contact.findFirst({
        where: { phone_whatsapp: { contains: '33695472237' } }
    })

    if (!contact) {
        console.log("Contact not found")
        return
    }

    const conversations = await prisma.conversation.findMany({
        where: { contactId: contact.id }
    })

    for (const conv of conversations) {
        console.log(`Deleting messages for conversation ${conv.id}...`)
        const deleted = await prisma.message.deleteMany({
            where: { conversationId: conv.id }
        })
        console.log(`Deleted ${deleted.count} messages.`)
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
