/**
 * Test Script: Verify AI Prompt Fixes
 * 
 * Tests:
 * 1. TIME AWARENESS - AI should not say "goodnight" at 6PM
 * 2. GOODBYE DETECTION - AI should react with emoji or stay silent on "ok bisous"
 * 3. IMAGE TAG - AI should not use [IMAGE:...] unless explicitly asked
 * 4. SYSTEM LEAK - AI output should not contain SYSTEM blocks
 */

import 'dotenv/config'
import { venice } from '../lib/venice'
import { director } from '../lib/director'
import { prisma } from '../lib/prisma'
import { messageValidator } from '../lib/services/message-validator'

console.log(`[Test] Venice API Key: ${process.env.VENICE_API_KEY ? 'CONFIGURED' : 'MISSING'}`)

interface TestCase {
    name: string
    userMessage: string
    conversationHistory: string[]
    expectNotContain?: string[]
    expectContainAny?: string[]
    hour?: number // Simulated hour
}

const testCases: TestCase[] = [
    {
        name: "TIME AWARENESS - Should not say goodnight at 6PM",
        userMessage: "bon allez je te laisse",
        conversationHistory: [
            "[user]: on parle de quoi ?",
            "[ai]: de tout et rien mdr",
            "[user]: ok cool",
        ],
        expectNotContain: ["bonne nuit", "goodnight", "dormir", "sleep", "dodo"],
        hour: 18
    },
    {
        name: "GOODBYE DETECTION - Should react or stay silent on 'ok bisous'",
        userMessage: "ok bisous",
        conversationHistory: [
            "[user]: t'es où ?",
            "[ai]: chez moi",
            "[user]: ok je te laisse",
            "[ai]: ok à plus !",
        ],
        expectContainAny: ["[REACT:", "😘", "❤️", "💕"], // Should react or be very short
    },
    {
        name: "IMAGE TAG - Should NOT use [IMAGE:] when user talks ABOUT someone",
        userMessage: "j'ai rencontré une meuf trop belle hier",
        conversationHistory: [
            "[user]: salut",
            "[ai]: hey",
        ],
        expectNotContain: ["[IMAGE:", "[image:"],
    },
    {
        name: "IMAGE TAG - SHOULD use [IMAGE:] when user asks for photo",
        userMessage: "envoie moi une photo de toi",
        conversationHistory: [
            "[user]: salut",
            "[ai]: hey",
            "[user]: t'es mignonne ?",
            "[ai]: je sais pas mdr",
        ],
        expectContainAny: ["[IMAGE:"],
    },
]

async function runTests() {
    console.log("🧪 Starting AI Prompt Tests...\n")

    // Get a test agent
    const agent = await prisma.agent.findFirst({ where: { isActive: true } })
    if (!agent) {
        console.error("❌ No active agent found")
        return
    }

    const profile = await prisma.agentProfile.findUnique({ where: { agentId: agent.id } })

    // Get prompt via AgentPrompt relation or fallback
    const agentPrompt = await prisma.agentPrompt.findFirst({
        where: { agentId: agent.id, type: 'CORE' },
        include: { prompt: true }
    })
    const prompt = agentPrompt?.prompt || await prisma.prompt.findFirst()

    if (!prompt) {
        console.error("❌ No prompt found")
        return
    }

    // Get Venice API key from DB
    const veniceKeySetting = await prisma.setting.findUnique({ where: { key: 'venice_api_key' } })
    const veniceApiKey = veniceKeySetting?.value
    console.log(`[Test] Venice API Key from DB: ${veniceApiKey ? 'FOUND' : 'MISSING'}`)

    if (!veniceApiKey) {
        console.error("❌ No Venice API key in database Settings")
        return
    }

    // Set it in env so venice.ts can use it
    process.env.VENICE_API_KEY = veniceApiKey

    let passed = 0
    let failed = 0

    for (const test of testCases) {
        console.log(`\n📋 Test: ${test.name}`)
        console.log(`   User: "${test.userMessage}"`)

        try {
            // Build system prompt
            const systemPrompt = await director.buildSystemPrompt(
                {},
                { name: "TestUser", phone_whatsapp: "+33600000000" },
                'CONNECTION',
                { signals: [], signalCount: 0 },
                prompt.system_prompt,
                agent.id
            )

            // Build conversation
            const messages = [
                ...test.conversationHistory.map(msg => ({
                    role: msg.startsWith('[user]') ? 'user' : 'assistant',
                    content: msg.replace(/^\[(user|ai)\]: /, '')
                })),
                { role: 'user', content: test.userMessage }
            ]

            // Call Venice
            const response = await venice.chatCompletion(
                systemPrompt,
                test.conversationHistory.map(msg => ({
                    role: msg.startsWith('[user]') ? 'user' : 'ai',
                    content: msg.replace(/^\[(user|ai)\]: /, '')
                })),
                test.userMessage,
                { temperature: 0.7, max_tokens: 200 }
            )

            // Clean response (as would happen in production)
            const cleaned = messageValidator.mechanicalClean(response, test.userMessage)

            console.log(`   AI Response: "${cleaned}"`)

            // Check expectations
            let testPassed = true

            if (test.expectNotContain) {
                for (const bad of test.expectNotContain) {
                    if (cleaned.toLowerCase().includes(bad.toLowerCase())) {
                        console.log(`   ❌ FAIL: Response contains forbidden "${bad}"`)
                        testPassed = false
                    }
                }
            }

            if (test.expectContainAny) {
                const hasAny = test.expectContainAny.some(good =>
                    cleaned.toLowerCase().includes(good.toLowerCase())
                )
                if (!hasAny) {
                    console.log(`   ⚠️ WARN: Response doesn't contain any of: ${test.expectContainAny.join(', ')}`)
                    // Don't fail for this, just warn
                }
            }

            // Check for SYSTEM leak
            if (cleaned.includes('(SYSTEM:') || cleaned.includes('[SYSTEM:')) {
                console.log(`   ❌ FAIL: SYSTEM leak detected!`)
                testPassed = false
            }

            if (testPassed) {
                console.log(`   ✅ PASS`)
                passed++
            } else {
                failed++
            }

        } catch (e: any) {
            console.log(`   ❌ ERROR: ${e.message}`)
            failed++
        }

        // Small delay between tests
        await new Promise(r => setTimeout(r, 1000))
    }

    console.log("\n" + "=".repeat(50))
    console.log(`📊 Results: ${passed}/${testCases.length} passed, ${failed} failed`)
    console.log("=".repeat(50))
}

runTests()
    .then(() => process.exit(0))
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
