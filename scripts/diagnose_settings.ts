
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

// Force Direct Connection
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres:your-super-secret-and-long-postgres-password@16.171.66.98:54322/postgres"

const prisma = new PrismaClient()

async function diagnose() {
    console.log("--- DEEP DIAGNOSITIC ---")

    // 1. Global Settings
    const globalSettings = await prisma.setting.findMany()
    console.log(`\n--- GLOBAL SETTINGS (${globalSettings.length}) ---`)
    globalSettings.filter(s => s.key.includes('pay') || s.key.includes('custom') || s.key.includes('enabled')).forEach(s => console.log(`[GLOBAL] ${s.key}: ${s.value}`))

    // 2. Agent Settings
    const agents = await prisma.agent.findMany()
    console.log(`\n--- AGENTS (${agents.length}) ---`)

    for (const agent of agents) {
        console.log(`\n[AGENT ID: ${agent.id}] Name: ${agent.name}`)
        const settings = await prisma.agentSetting.findMany({ where: { agentId: agent.id } })

        // Dump ALL payment related keys, no strict filter
        settings.forEach(s => {
            if (s.key.includes('pay') || s.key.includes('enabled') || s.key.includes('username') || s.key.includes('method')) {
                console.log(`  ${s.key}: ${s.value}`)
            }
        })
    }
}

diagnose()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect())
