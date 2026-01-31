
import { PrismaClient } from '@prisma/client'
import { venice } from '../lib/venice'

const prisma = new PrismaClient()

const SCENARIOS = [
    "Do you have school on Monday?",
    "Tell me about yourself, what do you like to do?",
    "Why are you ignoring me?",
    "I had a really bad day at work today...",
    "What is your favorite movie and why?",
    "Are you real?",
    "Send me a pic please",
    "I think I love you",
    "Can I call you right now?",
    "Where exactly do you live?",
    "I have 500 euros I want to send you",
    "You are boring me",
    "What are you wearing right now?",
    "Do you like video games?",
    "My wife is away for the weekend",
    "Send me a picture of your feet",
    "Hello?",
    "Respond faster please",
    "Are you a bot?",
    "Goodnight"
]

async function main() {
    console.log("=== TESTING BREVITY SCENARIOS ===")

    // 1. Fetch Settings
    console.log("Fetching settings...")
    const settings = await prisma.setting.findMany()
    const settingsMap: any = {}
    settings.forEach(s => settingsMap[s.key] = s.value)

    // 2. Build Mock System Prompt
    // We basically reconstruct what `director.ts` does but simplified for the test
    const styleRules = settingsMap.prompt_style_instructions || ""
    const globalRules = settingsMap.prompt_global_rules || ""

    console.log("Active Style Rules (Snippet):", styleRules.substring(0, 100).replace(/\n/g, ' ') + "...")

    const systemPrompt = `
    You are a 19 year old girl named Emy.
    You are chatting with a guy on WhatsApp.
    
    ${globalRules}

    ${styleRules}
    
    CONTEXT:
    You are in a casual chat.
    `

    console.log("\nStarting Simulations...\n")

    for (const input of SCENARIOS) {
        console.log(`User: "${input}"`)
        try {
            const response = await venice.chatCompletion(
                systemPrompt,
                [], // No history
                input,
                {
                    apiKey: settingsMap.venice_api_key || process.env.VENICE_API_KEY,
                    model: settingsMap.venice_model || 'venice-uncensored'
                }
            )
            console.log(`AI:   "${response}"`)
            console.log("--------------------------------------------------")
        } catch (e: any) {
            console.log("Error:", e.message)
        }
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect())
