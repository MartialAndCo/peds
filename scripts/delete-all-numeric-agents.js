const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function auditAndDelete() {
    console.log('🔍 Full Agent Audit\n')

    const allAgents = await prisma.agent.findMany({
        select: {
            id: true,
            name: true,
            isActive: true,
            createdAt: true
        },
        orderBy: { createdAt: 'asc' }
    })

    console.log(`Total agents in database: ${allAgents.length}\n`)

    const numericAgents = []
    const cuidAgents = []

    for (const agent of allAgents) {
        const isNumeric = /^\d+$/.test(agent.id)
        console.log(`Agent ID: "${agent.id}" (${agent.name}) - ${isNumeric ? 'NUMERIC ⚠️' : 'CUID ✅'}`)

        if (isNumeric) {
            numericAgents.push(agent)
        } else {
            cuidAgents.push(agent)
        }
    }

    console.log(`\n📊 Summary:`)
    console.log(`   CUID agents: ${cuidAgents.length}`)
    console.log(`   Numeric agents: ${numericAgents.length}`)

    if (numericAgents.length === 0) {
        console.log('\n✅ No numeric agents to delete!')
        return
    }

    console.log(`\n🗑️  Deleting ${numericAgents.length} numeric agents:\n`)

    for (const agent of numericAgents) {
        try {
            console.log(`   Deleting "${agent.id}" (${agent.name})...`)
            await prisma.agent.delete({ where: { id: agent.id } })
            console.log(`   ✅ Deleted "${agent.id}"`)
        } catch (e) {
            console.log(`   ❌ Failed to delete "${agent.id}": ${e.message}`)
        }
    }

    console.log('\n✅ Cleanup complete!')

    // Final verification
    const remaining = await prisma.agent.findMany({ select: { id: true, name: true } })
    console.log(`\n📊 Remaining agents: ${remaining.length}`)
    for (const a of remaining) {
        console.log(`   - ${a.id} (${a.name})`)
    }
}

auditAndDelete()
    .catch(e => {
        console.error('\n❌ Error:', e.message)
        console.error(e.stack)
    })
    .finally(() => prisma.$disconnect())
