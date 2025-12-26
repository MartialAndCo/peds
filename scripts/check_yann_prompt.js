const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- CHECKING CONVERSATION & PROMPT FOR YANN ---')
    const contact = await prisma.contact.findUnique({
        where: { phone_whatsapp: '+33695472237' } // Yann's number
    })

    if (!contact) {
        console.log('Contact not found')
        return
    }

    const conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id, status: 'active' },
        include: { prompt: true }
    })

    if (!conversation) {
        console.log('No active conversation found')
        return
    }

    console.log('Conversation ID:', conversation.id)
    console.log('Linked Prompt ID:', conversation.promptId)
    console.log('--- PROMPT CONTENT (Base Role) ---')
    console.log(conversation.prompt.system_prompt)
    console.log('----------------------------------')
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
