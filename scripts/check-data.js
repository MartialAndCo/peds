// Quick check that data is still present
const { PrismaClient } = require('@prisma/client')

async function main() {
    const prisma = new PrismaClient()

    const contacts = await prisma.contact.count()
    console.log('✅ Contacts count:', contacts)

    const agents = await prisma.agent.count()
    console.log('✅ Agents count:', agents)

    const agentContacts = await prisma.agentContact.count()
    console.log('✅ AgentContacts count:', agentContacts)

    const messages = await prisma.message.count()
    console.log('✅ Messages count:', messages)

    // Check new signals column exists
    const firstAC = await prisma.agentContact.findFirst()
    if (firstAC) {
        console.log('✅ AgentContact sample:', {
            id: firstAC.id,
            signals: firstAC.signals || '(column exists, empty)',
            trustScore: firstAC.trustScore
        })
    }

    await prisma.$disconnect()
}

main().catch(console.error)
