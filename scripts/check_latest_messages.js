const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Fetching last 5 messages...")
    const messages = await prisma.message.findMany({
        take: 5,
        orderBy: {
            timestamp: 'desc'
        },
        include: {
            conversation: {
                select: {
                    contact: {
                        select: {
                            name: true,
                            phone_whatsapp: true
                        }
                    }
                }
            }
        }
    })

    messages.forEach(m => {
        console.log(`[${m.timestamp.toISOString()}] ${m.sender} (${m.conversation.contact.name}): ${m.message_text}`)
    })
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
