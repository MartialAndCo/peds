
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

// Use Direct URL to avoid pooler issues
const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL } }
})

async function listAgents() {
    const agents = await prisma.agent.findMany()
    console.log("--- AGENTS LIST ---")
    agents.forEach(a => {
        console.log(`[${a.isActive ? 'ACTIVE' : 'INACTIVE'}] ID: ${a.id} | Name: ${a.name} | Created: ${a.createdAt.toISOString().split('T')[0]}`)
    })
}

listAgents()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
