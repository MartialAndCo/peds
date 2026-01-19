
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

// Force Direct Connection
const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL } }
})

async function debugState() {
    console.log("--- FULL STATE DEBUG ---")

    // 1. Agent Settings
    const aSettings = await prisma.agentSetting.findMany({
        where: { agentId: 1 },
        orderBy: { key: 'asc' }
    })
    console.log("\n[AGENT 1 SETTINGS]:")
    aSettings.filter(s => s.key.startsWith('payment')).forEach(s => {
        console.log(`- ${s.key}: ${s.value}`)
    })

    // 2. Global Settings
    const gSettings = await prisma.setting.findMany({
        orderBy: { key: 'asc' }
    })
    console.log("\n[GLOBAL SETTINGS]:")
    gSettings.filter(s => s.key.startsWith('payment')).forEach(s => {
        console.log(`- ${s.key}: ${s.value}`)
    })

}

debugState()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
