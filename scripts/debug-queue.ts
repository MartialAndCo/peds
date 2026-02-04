
import { prisma } from '../lib/prisma'

async function checkQueue() {
    const items = await prisma.messageQueue.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    })
    console.log(JSON.stringify(items, null, 2))
}

checkQueue().catch(console.error).finally(() => prisma.$disconnect())
