import { prisma } from '../lib/prisma'

async function inspectSettings() {
    console.log("--- GLOBAL SETTINGS KEYS ---")
    console.log("--- PAYMENT SETTINGS ---")
    const paymentSettings = await prisma.setting.findMany({
        where: {
            OR: [
                { key: { contains: 'pay' } },
                { key: { contains: 'venmo' } },
                { key: { contains: 'cash' } }
            ]
        }
    })
    paymentSettings.forEach(s => console.log(`${s.key}: ${s.value}`))

    console.log("\n--- AGENT SETTINGS KEYS ---")
    const agentSettings = await prisma.agentSetting.findMany({
        include: { agent: true }
    })
    agentSettings.forEach(s => console.log(`[${s.agent.name}] ${s.key}: ${s.value.substring(0, 50)}...`))
}

inspectSettings()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
