/**
 * Script to clean up legacy numeric Agent IDs
 * 
 * IMPORTANT: Run this ONLY after verifying that all data has been migrated to new CUID agents
 */

import { prisma } from '../lib/prisma'

async function main() {
    console.log('🔍 Scanning for legacy numeric agent IDs...')

    // Find all agents
    const allAgents = await prisma.agent.findMany({
        select: {
            id: true,
            name: true,
            createdAt: true,
            _count: {
                select: {
                    conversations: true,
                    settings: true
                }
            }
        }
    })

    // Separate numeric IDs from CUID
    const numericAgents = allAgents.filter(a => /^\d+$/.test(a.id))
    const cuidAgents = allAgents.filter(a => !/^\d+$/.test(a.id))

    console.log(`\n📊 Found ${allAgents.length} total agents`)
    console.log(`   - ${cuidAgents.length} CUID agents (new)`)
    console.log(`   - ${numericAgents.length} numeric agents (legacy)`)

    if (numericAgents.length === 0) {
        console.log('\n✅ No legacy numeric agents found!')
        return
    }

    console.log('\n⚠️  Legacy numeric agents found:')
    for (const agent of numericAgents) {
        console.log(`   - ID: ${agent.id} | Name: ${agent.name}`)
        console.log(`     Conversations: ${agent._count.conversations} | Settings: ${agent._count.settings}`)
    }

    // Safety check
    console.log('\n⚠️  SAFETY CHECK:')
    console.log('Before deleting legacy agents, verify that:')
    console.log('1. All conversations have been migrated to CUID agents')
    console.log('2. All settings have been copied to new agents')
    console.log('3. You have a database backup')
    console.log('\nTo delete these agents, uncomment the deletion code and run again.')

    // UNCOMMENT BELOW TO ACTUALLY DELETE
    /*
    console.log('\n🗑️  Deleting legacy numeric agents...')
    for (const agent of numericAgents) {
        console.log(`   Deleting agent ${agent.id} (${agent.name})...`)
        await prisma.agent.delete({
            where: { id: agent.id }
        })
    }
    console.log('\n✅ Cleanup complete!')
    */
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('❌ Error:', e)
        process.exit(1)
    })
