
import { prisma } from '@/lib/prisma'

async function inspect() {
    const user = await prisma.contact.findFirst({
        where: { name: { contains: 'The Student' } },
        include: {
            conversations: {
                include: {
                    messages: {
                        orderBy: { timestamp: 'asc' }
                    }
                }
            }
        }
    });

    if (!user) {
        console.log("User not found");
        return;
    }

    console.log(`User: ${user.name} (${user.phone_whatsapp})`);
    for (const c of user.conversations) {
        console.log(`Conversation ${c.id} (Status: ${c.status})`);
        for (const m of c.messages) {
            console.log(` - [${m.sender}] ${m.message_text} (Status: ${m.status})`);
        }
    }
}

inspect()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
