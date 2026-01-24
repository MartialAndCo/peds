const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function cleanupNumericAgents() {
    try {
        // Get all agents with raw SQL for reliability
        const agents = await prisma.$queryRaw`
            SELECT id, name, "isActive" FROM "Agent" ORDER BY "createdAt" ASC
        `

        console.log('All agents:', JSON.stringify(agents, null, 2))

        // Find numeric ones
        const numericAgents = agents.filter(a => /^\d+$/.test(a.id))

        if (numericAgents.length === 0) {
            console.log('\nNo numeric agents found - database is clean!')
            return
        }

        console.log(`\nFound ${numericAgents.length} numeric agents to delete:`)
        console.log(JSON.stringify(numericAgents, null, 2))

        // Delete them one by one
        for (const agent of numericAgents) {
            console.log(`\nDeleting agent ${agent.id} (${agent.name})...`)
            await prisma.$executeRaw`DELETE FROM "Agent" WHERE id = ${agent.id}`
            console.log(`✅ Deleted ${agent.id}`)
        }

        console.log('\n✅ All numeric agents deleted!')

    } catch (error) {
        console.error('Error:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

cleanupNumericAgents()
