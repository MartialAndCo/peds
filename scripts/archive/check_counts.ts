
import { prisma } from '../lib/prisma'

async function checkCounts() {
    console.log('Checking for data explosion...')

    const [queueCount, webhookCount, messageCount] = await Promise.all([
        prisma.incomingQueue.count(),
        prisma.webhookEvent.count(),
        prisma.message.count()
    ])

    console.log({
        queueCount,
        webhookCount,
        messageCount
    })

    // Check recent entries
    const recentQueue = await prisma.incomingQueue.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    })

    console.log('Recent Queue Items:', recentQueue.map(q => ({ id: q.id, status: q.status, attempts: q.attempts, createdAt: q.createdAt })))
}

checkCounts()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
