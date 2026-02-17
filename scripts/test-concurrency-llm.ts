
import { PrismaClient } from '@prisma/client'
import { whatsapp } from '@/lib/whatsapp'
import { handleChat } from '@/lib/handlers/chat'

// Monkey-patch WhatsApp to prevent actual sending and just log
whatsapp.sendText = async (to, text) => {
    console.log(`\n[MOCKED WHATSAPP] To: ${to}\n[MOCKED WHATSAPP] Message: "${text}"\n`)
    return { status: 'mocked' }
}
whatsapp.markAsRead = async () => true
whatsapp.sendTypingState = async () => true

const prisma = new PrismaClient()

async function main() {
    console.log("🚀 Starting LLM Concurrency Coherence Test...")

    // 1. Setup Test Contact
    const phone = 'LLM_TEST_USER'
    const agentId = (await prisma.agent.findFirst())?.id
    if (!agentId) throw new Error("No agent found")

    // Clean previous
    await prisma.message.deleteMany({ where: { conversation: { contact: { phone_whatsapp: phone } } } })

    const contact = await prisma.contact.upsert({
        where: { phone_whatsapp: phone },
        update: { status: 'active', testMode: true }, // testMode=true forces AI to respond fast (3-8s) but we want to test the Loop logic.
        create: { phone_whatsapp: phone, name: 'LLM Tester', status: 'active', testMode: true }
    })

    // Ensure valid conversation
    let conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id },
        include: { prompt: true }
    })

    if (!conversation) {
        const prompt = await prisma.prompt.findFirst()
        conversation = await prisma.conversation.create({
            data: { contactId: contact.id, agentId, promptId: prompt!.id, status: 'active', ai_enabled: true },
            include: { prompt: true }
        })
    }

    // Ensure unlocked and ACTIVE
    await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
            processingLock: null,
            status: 'active'
        }
    })

    // Refresh conversation object
    conversation = (await prisma.conversation.findUnique({ where: { id: conversation.id }, include: { prompt: true } }))!

    // 2. SCENARIO 1: Same Topic Burst
    // "Salut", "Tu es là?", "Réponds moi stp"
    console.log("\n\n=== SCENARIO 1: COHERENCE (Burst on same topic) ===")
    console.log("Sending 3 messages rapidly...")

    // We simulate the messages arriving in DB and calling handleChat in parallel (or rapid sequence)
    // We use `Promise.all` but with slight delays to ensure they are created in order in DB

    const msg1 = "Salut !"
    const msg2 = "Tu es là ?"
    const msg3 = "Pourquoi tu réponds pas ?"

    // We need to construct valid Payloads
    const createPayload = (txt: string, id: string) => ({
        fromMe: false,
        id: id,
        timestamp: Math.floor(Date.now() / 1000),
        type: 'chat',
        body: txt,
        _data: { notifyName: 'Tester' },
        from: phone + '@s.whatsapp.net'
    })

    // Fire them !
    // The first one should grab the lock.
    // The others should be "merged" or picked up by the tail loop.
    // CRITICAL: The `handleChat` code checks DB for *new assertions*. 
    // mocking `handleChat` simply calls `generateAndSendAI`.
    // `generateAndSendAI` reads `prisma.message`. NOT the arguments passed to it (except for the very first trigger).

    // So we must ensure they are IN THE DB.

    const p1 = handleChat(createPayload(msg1, 'msg_A1'), contact, conversation, {}, msg1, agentId)

    await new Promise(r => setTimeout(r, 200))
    const p2 = handleChat(createPayload(msg2, 'msg_A2'), contact, conversation, {}, msg2, agentId)

    await new Promise(r => setTimeout(r, 200))
    const p3 = handleChat(createPayload(msg3, 'msg_A3'), contact, conversation, {}, msg3, agentId)

    await Promise.all([p1, p2, p3])

    console.log("Waiting for AI processing and queuing...")
    await new Promise(r => setTimeout(r, 20000)) // Wait for 20s for all processing

    // FETCH QUIEUED MESSAGES
    const queue1 = await prisma.messageQueue.findMany({
        where: { contactId: contact.id, status: 'PENDING' },
        orderBy: { createdAt: 'asc' }
    })

    console.log("\n>>> SCENARIO 1 RESULTS (Queued Messages):")
    queue1.forEach(m => {
        console.log(`[AI RESPONSE] ID: ${m.id} | Scheduled: ${m.scheduledAt.toISOString()} | Content: "${m.content}"`)
    })

    // Clear queue for next scenario
    await prisma.messageQueue.deleteMany({ where: { contactId: contact.id } })

    console.log("=== SCENARIO 1 FINISHED ===")


    // 3. SCENARIO 2: Mixed Intents
    // "J'aime le chocolat", "En fait je suis au régime", "Quelle température il fait ?"
    console.log("\n\n=== SCENARIO 2: MIXED INTENTS ===")

    // Ensure unlocked
    await prisma.conversation.update({
        where: { id: conversation.id },
        data: { processingLock: null }
    })

    const msgB1 = "J'adore le chocolat c'est trop bon"
    const msgB2 = "Mais bon je suis au régime..."
    const msgB3 = "Dis tu penses quoi de la politique en France ?"

    const pb1 = handleChat(createPayload(msgB1, 'msg_B1'), contact, conversation, {}, msgB1, agentId)
    await new Promise(r => setTimeout(r, 200))
    const pb2 = handleChat(createPayload(msgB2, 'msg_B2'), contact, conversation, {}, msgB2, agentId)
    await new Promise(r => setTimeout(r, 200))
    const pb3 = handleChat(createPayload(msgB3, 'msg_B3'), contact, conversation, {}, msgB3, agentId)

    await Promise.all([pb1, pb2, pb3])

    console.log("Waiting for AI processing and queuing...")
    await new Promise(r => setTimeout(r, 20000)) // Wait 20s

    const queue2 = await prisma.messageQueue.findMany({
        where: { contactId: contact.id, status: 'PENDING' },
        orderBy: { createdAt: 'asc' }
    })

    console.log("\n>>> SCENARIO 2 RESULTS (Queued Messages):")
    queue2.forEach(m => {
        console.log(`[AI RESPONSE] ID: ${m.id} | Scheduled: ${m.scheduledAt.toISOString()} | Content: "${m.content}"`)
    })

    console.log("=== SCENARIO 2 FINISHED ===")
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
