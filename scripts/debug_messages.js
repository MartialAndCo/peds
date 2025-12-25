const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Fetching recent messages...")
    // Fetch specific conversation
    const conversation = await prisma.conversation.findFirst({
        where: { contact: { phone_whatsapp: { contains: '33695472237' } } },
        orderBy: { id: 'desc' },
        include: { messages: { orderBy: { timestamp: 'desc' }, take: 20 }, contact: true }
    })

    if (!conversation) {
        console.log("No conversation found.")
        return
    }

    console.log(`Conversation ID: ${conversation.id} with ${conversation.contact.phone_whatsapp}`)
    console.log("--- Last 20 Messages (Newest First) ---")
    conversation.messages.forEach(m => {
        console.log(`[${m.sender}] ${m.timestamp.toISOString()}: ${m.message_text.substring(0, 100)}...`)
    })
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
