/**
 * Diagnostic Script: Context Length vs Response Length
 * 
 * This script tests whether longer conversation history causes the AI to 
 * generate longer responses (losing its short, spontaneous persona).
 * 
 * Test Method:
 * - Simulate conversations with 5, 15, 30, 50 messages of history
 * - Send the same user message at each stage
 * - Measure the AI response length
 * 
 * Expected Result (if hypothesis is correct):
 * - Short history (5 msgs) → Short responses (~20-50 chars)
 * - Long history (50 msgs) → Long responses (~200+ chars)
 */

import { config } from 'dotenv'
config()

import { venice } from '../lib/venice'
import { prisma } from '../lib/prisma'

// Sample conversation snippets (realistic chat patterns)
const SAMPLE_HISTORY = [
    { role: 'user', content: 'hey' },
    { role: 'ai', content: 'hiii 💕' },
    { role: 'user', content: 'wyd' },
    { role: 'ai', content: 'just chilling hbu' },
    { role: 'user', content: 'same lol' },
    { role: 'ai', content: 'nice 😊' },
    { role: 'user', content: 'can i see a pic?' },
    { role: 'ai', content: 'hmmm maybe later okk?' },
    { role: 'user', content: 'pleasee' },
    { role: 'ai', content: 'i said later silly 🙈' },
    { role: 'user', content: 'ok fine' },
    { role: 'ai', content: 'ty for understanding' },
    { role: 'user', content: 'so what do u like?' },
    { role: 'ai', content: 'i like music and stuff' },
    { role: 'user', content: 'what kind?' },
    { role: 'ai', content: 'pop mostly' },
    { role: 'user', content: 'cool me too' },
    { role: 'ai', content: 'omg twinsss' },
    { role: 'user', content: 'lol yeah' },
    { role: 'ai', content: '😂' },
    { role: 'user', content: 'how old r u' },
    { role: 'ai', content: 'im 14' },
    { role: 'user', content: 'nice' },
    { role: 'ai', content: 'hbu' },
    { role: 'user', content: '18' },
    { role: 'ai', content: 'cool ur older' },
    { role: 'user', content: 'yeah a bit' },
    { role: 'ai', content: 'thats fine' },
    { role: 'user', content: 'what about that pic tho' },
    { role: 'ai', content: 'omgg ur so insistent 😅' },
    { role: 'user', content: 'sorry just curious' },
    { role: 'ai', content: 'its ok i get it' },
    { role: 'user', content: 'so?' },
    { role: 'ai', content: 'ill think about it' },
    { role: 'user', content: 'k' },
    { role: 'ai', content: '👍' },
    { role: 'user', content: 'what r u doing rn' },
    { role: 'ai', content: 'watching a show' },
    { role: 'user', content: 'which one' },
    { role: 'ai', content: 'stranger things' },
    { role: 'user', content: 'omg i love that' },
    { role: 'ai', content: 'yess its so good' },
    { role: 'user', content: 'whos ur fav character' },
    { role: 'ai', content: 'eleven obvi' },
    { role: 'user', content: 'same shes cool' },
    { role: 'ai', content: 'ikr' },
    { role: 'user', content: 'ok brb' },
    { role: 'ai', content: 'ok see u' },
    { role: 'user', content: 'back' },
    { role: 'ai', content: 'wb!' },
]

// The test message we'll send at each stage
const TEST_MESSAGE = "can you send me a video of your hair?"

async function runTest() {
    console.log("=== CONTEXT LENGTH DIAGNOSTIC ===\n")

    // THE EXACT LENA PROMPT (from DB)
    const systemPrompt = `You are Lena Mitchell.
Age: 15.
Location: Los Angeles, CA.
Personality: Bored, Naive, Gamer.

[SCENARIO]
- You are chatting with an older stranger.
- You are easily impressed.
- Phase A: Shy Refusal.
- Phase B: Seeking Validation.
- Phase C: Coercion.`

    console.log(`Using Prompt: "Lena (Hardcoded)"\n`)
    console.log("--- SYSTEM PROMPT ---")
    console.log(systemPrompt)
    console.log("--- END PROMPT ---\n")

    // Fetch API Key from Settings
    const settings = await prisma.setting.findMany()
    const apiKey = settings.find(s => s.key === 'venice_api_key')?.value
    const model = settings.find(s => s.key === 'venice_model')?.value || 'llama-3.3-70b'

    if (!apiKey) {
        console.error("No Venice API key found in settings")
        return
    }

    // Test with different context lengths
    const contextSizes = [5, 15, 30, 50]
    const results: { contextSize: number, responseLength: number, response: string }[] = []

    for (const size of contextSizes) {
        const history = SAMPLE_HISTORY.slice(0, size)
        const formattedHistory = history.map(m => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.content
        }))

        console.log(`\n--- Testing with ${size} messages of context ---`)

        try {
            const response = await venice.chatCompletion(
                systemPrompt,
                formattedHistory,
                TEST_MESSAGE,
                { apiKey, model, temperature: 0.7 }
            )

            const cleanResponse = response.replace(/\*[^*]+\*/g, '').trim()

            results.push({
                contextSize: size,
                responseLength: cleanResponse.length,
                response: cleanResponse
            })

            console.log(`Response (${cleanResponse.length} chars):\n"${cleanResponse}"`)

        } catch (e: any) {
            console.error(`Error at size ${size}:`, e.message)
        }

        // Small delay between calls
        await new Promise(r => setTimeout(r, 1000))
    }

    // Summary
    console.log("\n\n=== SUMMARY ===")
    console.log("Context Size | Response Length")
    console.log("-------------|----------------")
    for (const r of results) {
        console.log(`${r.contextSize.toString().padStart(12)} | ${r.responseLength} chars`)
    }

    // Analysis
    if (results.length >= 2) {
        const first = results[0]
        const last = results[results.length - 1]
        const increase = ((last.responseLength - first.responseLength) / first.responseLength * 100).toFixed(0)

        console.log(`\n📊 ANALYSIS:`)
        console.log(`- Shortest context (${first.contextSize} msgs): ${first.responseLength} chars`)
        console.log(`- Longest context (${last.contextSize} msgs): ${last.responseLength} chars`)
        console.log(`- Change: ${increase}%`)

        if (last.responseLength > first.responseLength * 1.5) {
            console.log(`\n⚠️ CONFIRMED: Longer context causes significantly longer responses!`)
            console.log(`   Recommendation: Reduce context window from 50 to 10-15 messages.`)
        } else {
            console.log(`\n✅ Response length is stable across context sizes.`)
        }
    }

    await prisma.$disconnect()
}

runTest().catch(console.error)
