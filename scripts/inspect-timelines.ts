
// @ts-nocheck
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function inspectData() {
    console.log("--- AGENTS ---")
    const agents = await prisma.agent.findMany()
    agents.forEach(a => console.log(`${a.name} (ID: ${a.id})`))

    console.log("\n--- AGENT EVENTS (TIMELINE) ---")
    const events = await prisma.agentEvent.findMany({
        include: { agent: true }
    })
    events.forEach(e => {
        console.log(`[${e.agent.name}] ${e.startDate.toISOString().split('T')[0]}: ${e.title} @ ${e.location}`)
    })
}

inspectData()
