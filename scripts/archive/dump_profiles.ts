
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        const agents = await prisma.agent.findMany({
            include: {
                profile: true,
                settings: true,
                agentPrompts: {
                    include: {
                        prompt: true
                    }
                }
            }
        })

        console.log("=== AGENT DUMP ===")
        for (const agent of agents) {
            console.log(`\n[AGENT: ${agent.name}] (ID: ${agent.id})`)
            console.log("--- Profile ---")
            console.log(agent.profile)
            console.log("--- Settings ---")
            agent.settings.forEach(s => console.log(`  ${s.key}: ${s.value}`))
            console.log("--- Prompts ---")
            agent.agentPrompts.forEach(p => console.log(`  [${p.type}]: ${p.prompt.name}`))
        }
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
