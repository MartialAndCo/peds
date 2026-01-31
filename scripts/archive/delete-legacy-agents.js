const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function deleteNumericAgents() {
    console.log('🔍 Finding legacy numeric agents...')

    const allAgents = await prisma.agent.findMany({
        select: { id: true, name: true }
    })

    const numericAgents = allAgents.filter(a => /^\d+$/.test(a.id))

    if (numericAgents.length === 0) {
        console.log('✅ No numeric agents found')
        return
    }

    console.log(`🗑️  Deleting ${numericAgents.length} numeric agents...`)

    for (const agent of numericAgents) {
        console.log(`   Deleting ${agent.id} (${agent.name})`)
        await prisma.agent.delete({ where: { id: agent.id } })
    }

    console.log('✅ Done!')
}

deleteNumericAgents()
    .catch(e => console.error('Error:', e.message))
    .finally(() => prisma.$disconnect())
