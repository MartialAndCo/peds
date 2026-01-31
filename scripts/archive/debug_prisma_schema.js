const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Checking prompts...')
    const prompts = await prisma.prompt.findMany()
    console.log('Prompts count:', prompts.length)
    if (prompts.length > 0) console.log('First prompt:', prompts[0])

    console.log('Checking contacts...')
    const contacts = await prisma.contact.findMany({ take: 1 })
    console.log('Contacts count:', await prisma.contact.count())
    if (contacts.length > 0) {
        console.log('First contact ID type:', typeof contacts[0].id)
        console.log('First contact:', contacts[0])
    }

    console.log('Checking conversations...')
    try {
        const conversations = await prisma.conversation.findMany({ take: 1 })
        console.log('Conversations count:', await prisma.conversation.count())
        if (conversations.length > 0) {
            console.log('First conversation contactId type:', typeof conversations[0].contactId)
            console.log('First conversation:', conversations[0])
        }
    } catch (e) {
        console.error('Error fetching conversations:', e)
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
