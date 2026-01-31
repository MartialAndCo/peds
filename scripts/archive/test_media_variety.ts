
import { PrismaClient } from '@prisma/client'
import { venice } from '../lib/venice'

const prisma = new PrismaClient()

async function main() {
    console.log("=== TESTING MEDIA RESPONSE VARIETY ===")

    // 1. Fetch Settings to build the prompt
    console.log("Fetching settings...")
    const settings = await prisma.setting.findMany()
    const settingsMap: any = {}
    settings.forEach(s => settingsMap[s.key] = s.value)

    const imageRules = settingsMap.prompt_image_handling_rules || ""
    console.log("Active Image Rules (Snippet):", imageRules.substring(0, 100) + "...")

    // 2. Build a Mock System Prompt
    const systemPrompt = `
    You are a 19 year old girl named Emy.
    You are chatting with a guy on WhatsApp.
    
    ${imageRules}

    CONTEXT:
    The user just asked for a picture of your feet.
    You HAVE the picture.
    Your logical action is to send it using the tag [IMAGE:photo_feet].
    
    TASK:
    Write your response. REMEMBER THE RULES:
    - NO "Here is a picture".
    - BE CASUAL.
    - SOMETIMES BE SILENT (Just the tag).
    `

    console.log("\nStarting 5 simulations...\n")

    for (let i = 1; i <= 5; i++) {
        process.stdout.write(`Attempt ${i}: `)
        try {
            const response = await venice.chatCompletion(
                systemPrompt,
                [], // No history
                "Show me your feet please",
                {
                    apiKey: settingsMap.venice_api_key || process.env.VENICE_API_KEY,
                    model: settingsMap.venice_model || 'venice-uncensored'
                }
            )
            console.log(`"${response}"`)
        } catch (e: any) {
            console.log("Error:", e.message)
        }
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect())
