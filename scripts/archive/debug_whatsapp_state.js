const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- DEBUGGING WHATSAPP STATE ---')

    // 1. Get recent conversations
    const conversations = await prisma.conversation.findMany({
        where: { status: 'active' },
        include: {
            contact: true,
            prompt: true,
            messages: {
                take: 5,
                orderBy: { timestamp: 'desc' }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
    })

    console.log(`Found ${conversations.length} active conversations.`)

    for (const conv of conversations) {
        console.log(`\n------------------------------------------------`)
        console.log(`Contact: ${conv.contact?.name} (${conv.contact?.phone_whatsapp})`)
        console.log(`Conversation ID: ${conv.id}`)
        console.log(`Prompt ID: ${conv.promptId}`)
        console.log(`Prompt Name: ${conv.prompt?.name}`)
        console.log(`Prompt Preview: ${conv.prompt?.system_prompt?.substring(0, 100)}...`)
        console.log(`AI Provider in Settings: (Need to fetch separately)`)

        console.log(`\nLast 3 Messages:`)
        conv.messages.reverse().forEach(m => {
            console.log(`[${m.sender}]: ${m.message_text.substring(0, 100)}`)
        })
    }

    // Check Settings
    const settings = await prisma.setting.findMany()
    const provider = settings.find(s => s.key === 'ai_provider')?.value
    console.log(`\nActive Provider Global Setting: ${provider}`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
