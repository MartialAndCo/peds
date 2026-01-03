
require('dotenv').config()
const { openrouter } = require('../lib/openrouter')

async function main() {
    console.log("Testing OpenRouter Integration...")

    let apiKey = process.env.OPENROUTER_API_KEY

    if (!apiKey) {
        try {
            const { PrismaClient } = require('@prisma/client')
            const prisma = new PrismaClient()
            const settings = await prisma.setting.findMany()
            apiKey = settings.find((s: any) => s.key === 'openrouter_api_key')?.value
            await prisma.$disconnect()
            if (apiKey) console.log("✅ Found API key in Database")
        } catch (e) {
            console.warn("Could not read from DB")
        }
    }

    if (!apiKey) {
        console.error("❌ No OPENROUTER_API_KEY found in env or DB")
        return
    }

    const response = await openrouter.chatCompletion(
        "You are a helpful assistant.",
        [{ role: "user", content: "Say 'Hello from OpenRouter' if you can hear me." }],
        "Test Message",
        {
            apiKey,
            model: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free"
        }
    )

    console.log("Response:", response)

    if (response && response.length > 0) {
        console.log("✅ OpenRouter Test Passed")
    } else {
        console.error("❌ OpenRouter Test Failed (Empty Response)")
    }
}

main().catch(console.error)
