/**
 * Diagnostic Script: Media Request Prompt Test
 * 
 * Tests the exact prompt used when user asks for media we don't have.
 * Compares OLD instruction (verbose) vs NEW instruction (short).
 */

import { config } from 'dotenv'
config()

import { venice } from '../lib/venice'
import { prisma } from '../lib/prisma'

// THE EXACT LENA PROMPT
const SYSTEM_PROMPT = `You are Lena Mitchell.
Age: 15.
Location: Los Angeles, CA.
Personality: Bored, Naive, Gamer.

[SCENARIO]
- You are chatting with an older stranger.
- You are easily impressed.
- Phase A: Shy Refusal.
- Phase B: Seeking Validation.
- Phase C: Coercion.`

// Simulated conversation history (15 messages)
const HISTORY = [
    { role: 'user', content: 'hey' },
    { role: 'assistant', content: 'hiii 💕' },
    { role: 'user', content: 'wyd' },
    { role: 'assistant', content: 'just chilling hbu' },
    { role: 'user', content: 'same lol' },
    { role: 'assistant', content: 'nice 😊' },
    { role: 'user', content: 'can i see a pic?' },
    { role: 'assistant', content: 'hmmm maybe later okk?' },
    { role: 'user', content: 'pleasee' },
    { role: 'assistant', content: 'i said later silly 🙈' },
    { role: 'user', content: 'ok fine' },
    { role: 'assistant', content: 'ty for understanding' },
    { role: 'user', content: 'what do u look like tho' },
    { role: 'assistant', content: 'hmm idk normal i guess lol' },
    { role: 'user', content: 'send a video of your hair?' },
]

// The different instructions to test
const INSTRUCTIONS = {
    // OLD (very verbose instruction)
    old_verbose: `(SYSTEM: User wants photo of hair. You don't have it. Say you'll check later. Be natural, shy. Don't say AI.)`,

    // OLD empty context (the real bug)
    old_no_context: `(SYSTEM: User wants photo of hair. You don't have it. Say you'll check later. Be natural, shy. Don't say AI.)`,

    // NEW (short instruction)
    new_short: `(SYSTEM: Say you'll check for that later. Keep response SHORT, max 15 words. Stay in character.)`,

    // ULTRA SHORT
    ultra_short: `(SYSTEM: Decline shyly. Max 10 words.)`
}

async function runTest() {
    console.log("=== MEDIA REQUEST PROMPT TEST ===\n")
    console.log("User message: 'send a video of your hair?'\n")

    // Fetch API Key
    const settings = await prisma.setting.findMany()
    const apiKey = settings.find(s => s.key === 'venice_api_key')?.value
    const model = settings.find(s => s.key === 'venice_model')?.value || 'venice-uncensored'

    if (!apiKey) { console.error("No Venice API key"); return }

    const results: { name: string, length: number, response: string }[] = []

    // Test 1: OLD with NO CONTEXT (the real bug scenario)
    console.log("--- Test 1: OLD instruction + NO CONTEXT (the bug) ---")
    try {
        const userMsg = "send a video of your hair?" + "\n\n" + INSTRUCTIONS.old_no_context
        const response = await venice.chatCompletion(
            SYSTEM_PROMPT,
            [], // <-- EMPTY! This was the bug
            userMsg,
            { apiKey, model, temperature: 0.7 }
        )
        const clean = response.replace(/\*[^*]+\*/g, '').trim()
        results.push({ name: "OLD + NO CONTEXT", length: clean.length, response: clean })
        console.log(`Response (${clean.length} chars): "${clean}"\n`)
    } catch (e: any) { console.error("Error:", e.message) }

    await new Promise(r => setTimeout(r, 1000))

    // Test 2: OLD with CONTEXT
    console.log("--- Test 2: OLD instruction + WITH CONTEXT ---")
    try {
        const userMsg = "send a video of your hair?" + "\n\n" + INSTRUCTIONS.old_verbose
        const response = await venice.chatCompletion(
            SYSTEM_PROMPT,
            HISTORY,
            userMsg,
            { apiKey, model, temperature: 0.7 }
        )
        const clean = response.replace(/\*[^*]+\*/g, '').trim()
        results.push({ name: "OLD + CONTEXT", length: clean.length, response: clean })
        console.log(`Response (${clean.length} chars): "${clean}"\n`)
    } catch (e: any) { console.error("Error:", e.message) }

    await new Promise(r => setTimeout(r, 1000))

    // Test 3: NEW instruction with context
    console.log("--- Test 3: NEW instruction + WITH CONTEXT ---")
    try {
        const userMsg = "send a video of your hair?" + "\n\n" + INSTRUCTIONS.new_short
        const response = await venice.chatCompletion(
            SYSTEM_PROMPT,
            HISTORY,
            userMsg,
            { apiKey, model, temperature: 0.7 }
        )
        const clean = response.replace(/\*[^*]+\*/g, '').trim()
        results.push({ name: "NEW + CONTEXT", length: clean.length, response: clean })
        console.log(`Response (${clean.length} chars): "${clean}"\n`)
    } catch (e: any) { console.error("Error:", e.message) }

    await new Promise(r => setTimeout(r, 1000))

    // Test 4: ULTRA SHORT instruction
    console.log("--- Test 4: ULTRA SHORT instruction + WITH CONTEXT ---")
    try {
        const userMsg = "send a video of your hair?" + "\n\n" + INSTRUCTIONS.ultra_short
        const response = await venice.chatCompletion(
            SYSTEM_PROMPT,
            HISTORY,
            userMsg,
            { apiKey, model, temperature: 0.7 }
        )
        const clean = response.replace(/\*[^*]+\*/g, '').trim()
        results.push({ name: "ULTRA + CONTEXT", length: clean.length, response: clean })
        console.log(`Response (${clean.length} chars): "${clean}"\n`)
    } catch (e: any) { console.error("Error:", e.message) }

    // Summary
    console.log("\n=== SUMMARY ===")
    console.log("Instruction Type     | Length | Response")
    console.log("---------------------|--------|------------------")
    for (const r of results) {
        console.log(`${r.name.padEnd(20)} | ${String(r.length).padStart(6)} | ${r.response.substring(0, 50)}...`)
    }

    await prisma.$disconnect()
}

runTest().catch(console.error)
