const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Checking Pending Requests...')
    const pendings = await prisma.pendingRequest.findMany({
        where: { status: 'pending' }
    })

    console.log(`Found ${pendings.length} pending requests:`)
    pendings.forEach(p => {
        console.log(`- ID: ${p.id}`)
        console.log(`  Type: ${p.mediaType} (${p.description})`)
        console.log(`  Requester: ${p.requesterPhone}`)
        console.log(`  Contact Name: ${p.conversation?.contact?.name}`)
        console.log(`  Created: ${p.createdAt}`)
        console.log('---')
    })

    console.log('\nChecking recent fulfilled requests (last 5):')
    const fulfilled = await prisma.pendingRequest.findMany({
        where: { status: 'fulfilled' },
        orderBy: { updatedAt: 'desc' },
        take: 5
    })
    fulfilled.forEach(p => {
        console.log(`- ID: ${p.id} (FULFILLED)`)
        console.log(`  Type: ${p.mediaType}`)
        console.log(`  Requester: ${p.requesterPhone}`)
        console.log(`  Updated: ${p.updatedAt}`)
        console.log('---')
    })
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
