
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Mock dependencies
const mockPayload = {
    fromMe: false,
    id: 'test_msg_1',
    timestamp: Math.floor(Date.now() / 1000),
    type: 'chat',
    _data: { notifyName: 'TestUser' }
}

async function main() {
    console.log("🚀 Starting Concurrency Test...")

    // 1. Setup Test Contact & Conversation
    const phone = 'CONCURRENCY_TEST_USER'

    // Cleanup
    await prisma.message.deleteMany({ where: { sender: 'contact', message_text: { contains: 'CONCURRENCY_TEST' } } })

    let contact = await prisma.contact.upsert({
        where: { phone_whatsapp: phone },
        update: { status: 'active' },
        create: { phone_whatsapp: phone, name: 'Concurrency Tester', status: 'active' }
    })

    // Fetch a valid agent
    const agent = await prisma.agent.findFirst()
    if (!agent) throw new Error("No agents found in DB")
    console.log(`Using Agent: ${agent.name} (${agent.id})`)

    let conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id },
        include: { prompt: true }
    })

    // Ensure conversation exists
    if (!conversation) {
        const prompt = await prisma.prompt.findFirst()
        if (!prompt) throw new Error("No prompts found in DB")

        conversation = await prisma.conversation.create({
            data: {
                contactId: contact.id,
                agentId: agent.id, // Use valid agent ID
                promptId: prompt.id,
                status: 'active'
            },
            include: { prompt: true }
        })
    } else {
        // Update agentId if needed/missing
        if (!conversation.agentId) {
            conversation = await prisma.conversation.update({
                where: { id: conversation.id },
                data: { agentId: agent.id },
                include: { prompt: true }
            })
        }
    }

    // Force unlock
    await prisma.conversation.update({
        where: { id: conversation.id },
        data: { processingLock: null }
    })
    console.log(`✅ Conversation ${conversation.id} ready and unlocked.`)

    // 2. Simulate 3 concurrent requests
    // We can't import handleChat directly easily if it has complex dependencies (like Venice/WhatsApp).
    // But we can simulate the LOCKING logic which is what we changed.

    console.log("⚡ Firing 3 concurrent handler simulations...")

    const promises = [1, 2, 3].map(async (i) => {
        const delay = Math.random() * 50 // reduced delay to increase collision chance
        await new Promise(r => setTimeout(r, delay))

        console.log(`[Worker ${i}] Attempting lock...`)

        // Simulate attemptLock
        const now = new Date()
        // 30s timeout logic simulation
        const cutoff = new Date(now.getTime() - 30000)

        const result = await prisma.conversation.updateMany({
            where: {
                id: conversation.id,
                OR: [
                    { processingLock: null },
                    { processingLock: { lt: cutoff } }
                ]
            },
            data: { processingLock: now }
        })

        const acquired = result.count > 0

        if (acquired) {
            console.log(`[Worker ${i}] ✅ LOCK ACQUIRED! Doing work...`)
            // Simulate thinking time longer than other workers arrival
            await new Promise(r => setTimeout(r, 2000))

            // Check for new "messages"
            console.log(`[Worker ${i}] Checking for new messages (Tail Loop)...`)

            console.log(`[Worker ${i}] 🏁 Work done. Releasing lock.`)
            await prisma.conversation.update({
                where: { id: conversation.id },
                data: { processingLock: null }
            })
        } else {
            console.log(`[Worker ${i}] ❌ Lock BUSY. Merging into active process.`)
        }
    })

    await Promise.all(promises)
    console.log("✅ Test Complete.")

}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
