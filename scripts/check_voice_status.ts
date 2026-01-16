
import { prisma } from '../lib/prisma'

async function main() {
    console.log('--- Recent Pending Requests ---')
    const requests = await prisma.pendingRequest.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    })
    console.log(JSON.stringify(requests, null, 2))

    console.log('\n--- Recent Voice Clips ---')
    const clips = await prisma.voiceClip.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    })
    console.log(JSON.stringify(clips, null, 2))
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
