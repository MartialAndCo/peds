
import { prisma } from '../lib/prisma'

async function main() {
    const pending = await prisma.pendingRequest.findFirst({
        where: {
            status: 'pending',
            mediaType: 'audio'
        },
        orderBy: { createdAt: 'asc' }
    })
    console.log('Oldest Pending Request:', pending)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
