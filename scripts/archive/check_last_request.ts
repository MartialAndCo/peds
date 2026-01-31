
import { prisma } from '../lib/prisma'

async function main() {
    const last = await prisma.pendingRequest.findFirst({
        orderBy: { createdAt: 'desc' }
    })
    console.log('Last Request:', last)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
