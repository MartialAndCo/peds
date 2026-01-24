const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const prisma = new PrismaClient()

async function cleanupNumericAgentsWithLog() {
    const logFile = 'agent-cleanup-log.txt'
    let log = ''

    function addLog(msg) {
        console.log(msg)
        log += msg + '\n'
    }

    try {
        addLog('=== AGENT CLEANUP SCRIPT ===\n')
        addLog('Fetching all agents...\n')

        const agents = await prisma.agent.findMany({
            select: { id: true, name: true, isActive: true, createdAt: true }
        })

        addLog(`Total agents: ${agents.length}\n`)

        for (const agent of agents) {
            const isNumeric = /^\d+$/.test(agent.id)
            addLog(`  - ID: "${agent.id}" | Name: ${agent.name} | Type: ${isNumeric ? 'NUMERIC' : 'CUID'}`)
        }

        addLog('\n--- Filtering numeric agents ---\n')
        const numericAgents = agents.filter(a => /^\d+$/.test(a.id))

        addLog(`Found ${numericAgents.length} numeric agents\n`)

        if (numericAgents.length === 0) {
            addLog('✅ No numeric agents to delete!\n')
            fs.writeFileSync(logFile, log)
            return
        }

        addLog('Deleting numeric agents:\n')
        for (const agent of numericAgents) {
            try {
                addLog(`  Deleting ${agent.id} (${agent.name})...`)
                await prisma.agent.delete({ where: { id: agent.id } })
                addLog(`  ✅ Deleted\n`)
            } catch (e) {
                addLog(`  ❌ Error: ${e.message}\n`)
            }
        }

        addLog('\n--- Final verification ---\n')
        const remaining = await prisma.agent.findMany({ select: { id: true, name: true } })
        addLog(`Remaining agents: ${remaining.length}\n`)
        for (const a of remaining) {
            addLog(`  - ${a.id} (${a.name})`)
        }

        const stillNumeric = remaining.filter(a => /^\d+$/.test(a.id)).length
        if (stillNumeric > 0) {
            addLog(`\n⚠️  WARNING: ${stillNumeric} numeric agents still exist!`)
        } else {
            addLog('\n✅ SUCCESS: All agents are now using CUID!')
        }

        fs.writeFileSync(logFile, log)
        addLog(`\nLog written to: ${logFile}`)

    } catch (error) {
        addLog(`\n❌ FATAL ERROR: ${error.message}`)
        addLog(error.stack)
        fs.writeFileSync(logFile, log)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

cleanupNumericAgentsWithLog()
