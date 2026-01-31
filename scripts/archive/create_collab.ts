import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const email = 'collab@peds.com'
    const password = 'password'
    const hashedPassword = await bcrypt.hash(password, 10)

    // 1. Find the latest Agent (to assign to this user)
    const latestAgent = await prisma.agent.findFirst({
        orderBy: { createdAt: 'desc' }
    })

    if (!latestAgent) {
        console.error('No agents found! Create an agent first.')
        return
    }

    console.log(`Found Latest Agent: ${latestAgent.name} (ID: ${latestAgent.id})`)

    // 2. Create/Update the Collaborator User
    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            role: 'COLLABORATOR',
            agents: {
                connect: { id: latestAgent.id }
            }
        },
        create: {
            email,
            password: hashedPassword,
            role: 'COLLABORATOR',
            agents: {
                connect: { id: latestAgent.id }
            }
        },
        include: { agents: true }
    })

    console.log(`
    ✅ SUCCESS!
    User Created: ${user.email}
    Password: ${password}
    Role: ${user.role}
    Assigned to Agent: ${user.agents[0]?.name}
    `)
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect())
