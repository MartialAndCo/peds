
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

// Force Direct Connection
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres:your-super-secret-and-long-postgres-password@16.171.66.98:54322/postgres"

const prisma = new PrismaClient()

async function forceUpdate() {
    console.log("--- FORCING PAYMENTS ON ALL ACTIVE AGENTS ---")

    const agents = await prisma.agent.findMany({ where: { isActive: true } })
    console.log(`Found ${agents.length} active agents.`)

    for (const agent of agents) {
        const agentId = agent.id
        console.log(`Processing Agent: ${agent.name} (ID: ${agentId})`)

        // 1. Zelle
        await prisma.agentSetting.upsert({
            where: { agentId_key: { agentId, key: 'payment_zelle_enabled' } },
            update: { value: 'true' },
            create: { agentId, key: 'payment_zelle_enabled', value: 'true' }
        })

        // 2. CashApp
        await prisma.agentSetting.upsert({
            where: { agentId_key: { agentId, key: 'payment_cashapp_enabled' } },
            update: { value: 'true' },
            create: { agentId, key: 'payment_cashapp_enabled', value: 'true' }
        })

        // 3. PayPal
        await prisma.agentSetting.upsert({
            where: { agentId_key: { agentId, key: 'payment_paypal_enabled' } },
            update: { value: 'true' },
            create: { agentId, key: 'payment_paypal_enabled', value: 'true' }
        })

        // 4. Usernames (Default if missing, or force update)
        await prisma.agentSetting.upsert({
            where: { agentId_key: { agentId, key: 'payment_zelle_username' } },
            update: { value: 'lena.zelle@gmail.com' },
            create: { agentId, key: 'payment_zelle_username', value: 'lena.zelle@gmail.com' }
        })
        await prisma.agentSetting.upsert({
            where: { agentId_key: { agentId, key: 'payment_cashapp_username' } },
            update: { value: '$LenaCash' },
            create: { agentId, key: 'payment_cashapp_username', value: '$LenaCash' }
        })
        await prisma.agentSetting.upsert({
            where: { agentId_key: { agentId, key: 'payment_paypal_username' } },
            update: { value: 'lena344' },
            create: { agentId, key: 'payment_paypal_username', value: 'lena344' }
        })
        console.log(`✅ Agent ${agentId} Updated`)
    }
}

forceUpdate()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect())
