// Simple script to check legacy numeric agents
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('🔍 Scanning for legacy numeric agent IDs...\n')

    const allAgents = await prisma.agent.findMany({
        select: {
            id: true,
            name: true,
            createdAt: true,
            isActive: true,
            _count: {
                select: {
                    conversations: true,
                    settings: true
                }
            }
        },
        orderBy: { createdAt: 'asc' }
    })

    const numericAgents = allAgents.filter(a => /^\d+$/.test(a.id))
    const cuidAgents = allAgents.filter(a => !/^\d+$/.test(a.id))

    console.log(`📊 Database Status:`)
    console.log(`   Total Agents: ${allAgents.length}`)
    console.log(`   ✅ CUID Agents (new): ${cuidAgents.length}`)
    console.log(`   ⚠️  Numeric Agents (legacy): ${numericAgents.length}\n`)

    if (cuidAgents.length > 0) {
        console.log('✅ CUID Agents:')
        for (const agent of cuidAgents) {
            console.log(`   - ${agent.id} | ${agent.name} | Active: ${agent.isActive}`)
            console.log(`     Conversations: ${agent._count.conversations}, Settings: ${agent._count.settings}`)
        }
        console.log('')
    }

    if (numericAgents.length > 0) {
        console.log('⚠️  LEGACY Numeric Agents:')
        for (const agent of numericAgents) {
            console.log(`   - ID: ${agent.id} | ${agent.name} | Active: ${agent.isActive}`)
            console.log(`     Conversations: ${agent._count.conversations}, Settings: ${agent._count.settings}`)
        }
        console.log('\n🗑️  To delete legacy agents, run:')
        console.log('   node scripts/delete-legacy-agents.js')
    } else {
        console.log('✅ No legacy numeric agents found! Database is clean.')
    }
}

main()
    .catch(e => {
        console.error('❌ Error:', e.message)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
