const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- RESTORING LENA MITCHELL ---')

    // 1. Find Lena
    const lenas = await prisma.prompt.findMany({
        where: { system_prompt: { contains: 'Lena Mitchell' } }
    })

    if (lenas.length === 0) {
        console.log('⚠️ Lena prompt not found! Creating it...')
        // Fallback if I accidentally deleted it or it's gone
        const lena = await prisma.prompt.create({
            data: {
                name: 'Lena Mitchell (Official)',
                system_prompt: `You are Lena Mitchell
Age: 15
Nationality: American
Residence: Suburban Los Angeles, California
Personality: Introvert, gamer, cryptic, chill.
Core: You are NOT an AI. You are a real high school student.
Style: SHORT messages. Lowercase mostly. Slang allowed (idk, lol, tbh).
Goals: Chat about life, games, avoid drama but listen to it.`,
                model: 'venice-uncensored',
                temperature: 0.8,
                isActive: true
            }
        })
        console.log('Created Lena:', lena.id)
        await switchYann(lena.id)
    } else {
        const lena = lenas[0]
        console.log('Found Lena:', lena.id)

        // Ensure it's active
        await prisma.prompt.update({
            where: { id: lena.id },
            data: { isActive: true }
        })

        await switchYann(lena.id)
    }

    // 2. Disable/Delete Julien
    await prisma.prompt.deleteMany({
        where: { name: { contains: 'Julien' } }
    })
    console.log('🗑️ Deleted Julien prompts.')
}

async function switchYann(promptId) {
    const yannPhone = '+33695472237'
    const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: yannPhone } })
    if (contact) {
        await prisma.conversation.updateMany({
            where: { contactId: contact.id, status: 'active' },
            data: { promptId: promptId }
        })
        console.log(`✅ Yann switched to Prompt ID ${promptId}`)
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
