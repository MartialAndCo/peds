const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function listAgents() {
    const agents = await prisma.agent.findMany({
        select: { id: true, name: true, isActive: true },
        orderBy: { createdAt: 'asc' }
    })

    console.log('=== CURRENT AGENTS IN DATABASE ===\n')

    if (agents.length === 0) {
        console.log('No agents found!')
        return
    }

    agents.forEach((agent, idx) => {
        const isNumeric = /^\d+$/.test(agent.id)
        const label = isNumeric ? '⚠️  NUMERIC (LEGACY)' : '✅ CUID'
        console.log(`${idx + 1}. ID: ${agent.id}`)
        console.log(`   Name: ${agent.name}`)
        console.log(`   Type: ${label}`)
        console.log(`   Active: ${agent.isActive}`)
        console.log('')
    })

    const numericCount = agents.filter(a => /^\d+$/.test(a.id)).length
    const cuidCount = agents.filter(a => !/^\d+$/.test(a.id)).length

    console.log('=== SUMMARY ===')
    console.log(`Total: ${agents.length}`)
    console.log(`CUID: ${cuidCount}`)
    console.log(`Numeric: ${numericCount}`)

    if (numericCount > 0) {
        console.log('\n⚠️  WARNING: Numeric agents still exist!')
    } else {
        console.log('\n✅ All agents are using CUID!')
    }
}

listAgents()
    .catch(e => console.error('Error:', e.message))
    .finally(() => prisma.$disconnect())
