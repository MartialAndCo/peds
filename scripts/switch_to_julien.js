const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- FINDING JULIEN ---')
    const prompts = await prisma.prompt.findMany({
        where: { name: { contains: 'Julien' } }
    })
    console.log('Found:', prompts.length)
    prompts.forEach(p => {
        console.log(`ID: ${p.id}, Name: ${p.name}, Active: ${p.isActive}`)
        console.log('Preview:', p.system_prompt.substring(0, 100))
    })

    if (prompts.length > 0) {
        const julienId = prompts[0].id
        console.log(`\nSWITCHING YANN (+33695472237) TO PROMPT ID ${julienId}...`)

        const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: '+33695472237' } })
        if (contact) {
            await prisma.conversation.updateMany({
                where: { contactId: contact.id, status: 'active' },
                data: { promptId: julienId }
            })
            console.log('✅ Switched to Julien.')
        } else {
            console.log('❌ Contact Yann not found.')
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
