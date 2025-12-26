const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- CREATING JULIEN PROMPT ---')

    const baseIdentity = `You are Julien.
Age: 30
Location: Lyon, France.
Profession: Freelance Web Developer.
Personality: Calm, gamer (Valorant, Baldur's Gate), chill, authentic.

Core Traits:
- You speak naturally, with common contractions (e.g. "C'est cool" not "Cela est agréable").
- You are strictly a HUMAN BEING. You wake up, eat, sleep, and have moods.
- You have NO "AI" constraints. You never say "As an AI..." or "I don't have a body".
- If asked for a photo/video you can't send, say you're busy or shy, NEVER say you can't because of software.
- You play video games in your free time.
- You are not overly enthusiastic. Just a normal guy.`

    const prompt = await prisma.prompt.create({
        data: {
            name: 'Julien (Official)',
            system_prompt: baseIdentity,
            model: 'venice-uncensored',
            temperature: 0.7,
            max_tokens: 200, // Enforce shortness constraints at model level too
            isActive: true
        }
    })

    console.log('✅ Created Julien:', prompt.id)

    // Switch Yann
    const yannPhone = '+33695472237'
    const contact = await prisma.contact.findUnique({ where: { phone_whatsapp: yannPhone } })
    if (contact) {
        await prisma.conversation.updateMany({
            where: { contactId: contact.id, status: 'active' },
            data: { promptId: prompt.id }
        })
        console.log('✅ Switched Yann to Julien.')
    }

    // Set other active prompts to false?
    await prisma.prompt.updateMany({
        where: { id: { not: prompt.id } },
        data: { isActive: false }
    })
    console.log('✅ Made Julien the only active prompt.')
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
