
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔄 Starting migration to Multi-Agent architecture...')

    // 1. Check if default agent "Lena" exists
    let lena = await prisma.agent.findFirst({
        where: { name: 'Lena' }
    })

    if (!lena) {
        console.log('➕ Creating default agent "Lena"...')
        lena = await prisma.agent.create({
            data: {
                name: 'Lena',
                phone: 'DEFAULT_LENA_PHONE', // IMPORTANT: User needs to update this!
                color: '#E91E63', // Pink for Lena
                isActive: true
            }
        })
        console.log(`✅ Created Lena with ID: ${lena.id}`)
    } else {
        console.log(`ℹ️ Agent "Lena" already exists (ID: ${lena.id})`)
    }

    // 2. Assign all orphan conversations to Lena
    const updateResult = await prisma.conversation.updateMany({
        where: {
            agentId: null
        },
        data: {
            agentId: lena.id
        }
    })

    console.log(`🔗 Linked ${updateResult.count} existing conversations to Lena.`)
    console.log('🎉 Migration complete!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
