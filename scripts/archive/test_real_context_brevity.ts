
import { prisma } from '../lib/prisma'
import { director } from '../lib/director'
import { settingsService } from '../lib/settings-cache'
import { venice } from '../lib/venice'

async function main() {
    console.log("=== REAL WORLD BREVITY TEST (Heavy Context) ===")

    // 1. Get Global Settings (where the Brevity Rules live)
    const settings = await settingsService.getSettings()
    console.log(`[Settings] Brevity Rules Present: ${settings.prompt_style_instructions?.length > 10 ? 'YES' : 'NO'}`)
    console.log(`[Settings] Global Rules Present: ${settings.prompt_global_rules?.length > 10 ? 'YES' : 'NO'}`)

    // 2. Setup Dummy Contact with Heavy History
    const phone = '9999999999'
    const contact = await prisma.contact.upsert({
        where: { phone_whatsapp: phone },
        update: {},
        create: {
            phone_whatsapp: phone,
            name: "Brevity Tester",
            status: "active",
            agentPhase: "CONNECTION"
        }
    })

    // Find or Create Prompt
    let prompt = await prisma.prompt.findFirst()
    if (!prompt) {
        prompt = await prisma.prompt.create({
            data: {
                name: "Test Prompt",
                system_prompt: "You are a helpful assistant."
            }
        })
    }

    // Ensure conversation exists
    const conversation = await prisma.conversation.upsert({
        where: { id: 99999 }, // Fixed ID for test
        update: {},
        create: {
            id: 99999,
            contactId: contact.id,
            promptId: prompt.id,
            status: 'active'
        }
    })

    // Seed History (if empty)
    const count = await prisma.message.count({ where: { conversationId: conversation.id } })
    if (count < 50) {
        console.log("Seeding 50 messages of history...")
        for (let i = 0; i < 50; i++) {
            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    sender: i % 2 === 0 ? 'contact' : 'ai',
                    message_text: i % 2 === 0 ? "Tell me more about your day." : "it was okay just chilling.",
                    timestamp: new Date(Date.now() - (50 - i) * 1000 * 60)
                }
            })
        }
    }

    // 3. Build Real System Prompt
    console.log("Building FULL System Prompt (Director)...")
    const { phase, details, reason } = await director.determinePhase(phone)

    // Fetch base prompt manually to pass to director (simulating handleChat)
    const basePrompt = (await prisma.prompt.findFirst())?.system_prompt || "You are a friend."

    const systemPrompt = await director.buildSystemPrompt(
        settings,
        contact,
        phase,
        details,
        basePrompt,
        undefined,
        reason
    )

    console.log(`[Prompt] System Prompt Length: ${systemPrompt.length} chars`)
    console.log(`[Prompt] Contains 'EXTREME BREVITY': ${systemPrompt.includes('EXTREME BREVITY')}`)

    // 4. Prepare Context (Last 50 messages)
    const history = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { timestamp: 'desc' },
        take: 50
    })
    const messagesForAI = history.reverse().map(m => ({
        role: m.sender === 'contact' ? 'user' : 'ai',
        content: m.message_text
    }))

    const contextMessages = messagesForAI.slice(0, -1)

    // 5. Test Input
    const lastUserMessage = "wait so do you actually have a job or what are you doing right now?"
    console.log(`\n[User Input]: "${lastUserMessage}"`)

    // 6. Generate
    console.log("Generating response (Venice)...")
    const start = Date.now()

    const response = await venice.chatCompletion(
        systemPrompt,
        contextMessages,
        lastUserMessage,
        {
            apiKey: settings.venice_api_key,
            model: settings.venice_model || 'venice-uncensored',
            temperature: 0.7,
            max_tokens: 500
        }
    )

    const duration = Date.now() - start

    console.log("\n=== RESULT ===")
    console.log(`[Response]: "${response}"`)
    console.log(`[Stats]: ${response.length} chars, ${response.split(' ').length} words`)
    console.log(`[Time]: ${duration}ms`)

    if (response.split(' ').length > 15) {
        console.error("FAIL: Response is too long (> 15 words).")
    } else {
        console.log("PASS: Brevity maintained.")
    }
}

main().catch(console.error)
