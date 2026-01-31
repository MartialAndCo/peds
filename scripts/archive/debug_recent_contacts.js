const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- DEBUGGING RECENT CONTACTS ---')

    const contacts = await prisma.contact.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            conversations: true
        }
    })

    console.log(`Found ${contacts.length} recent contacts.`)

    for (const c of contacts) {
        console.log(`\nContact: ${c.name} (${c.phone_whatsapp}) [${c.id}]`)
        console.log(`Created At: ${c.createdAt}`)
        if (c.conversations.length === 0) {
            console.log('❌ NO CONVERSATIONS FOUND')
        }
        for (const conv of c.conversations) {
            console.log(`  - Conv ID: ${conv.id} | Status: ${conv.status.toUpperCase()} | PromptID: ${conv.promptId}`)

            const msgCount = await prisma.message.count({ where: { conversationId: conv.id } })
            console.log(`    Messages: ${msgCount}`)
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
