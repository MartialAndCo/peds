import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const convs = await prisma.conversation.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, agentId: true, contact: { select: { phone_whatsapp: true } } }
    })
    console.log("Recent conversations:")
    console.dir(convs, { depth: null })

    const pendingQueues = await prisma.messageQueue.findMany({
        where: { status: 'PENDING' },
        include: { conversation: { select: { agentId: true } } },
        take: 10
    })
    console.log("Pending message queues with agentId:")
    console.dir(pendingQueues.map(q => ({ id: q.id, agentId: q.conversation.agentId })), { depth: null })
}

main().catch(console.error).finally(() => prisma.$disconnect())
