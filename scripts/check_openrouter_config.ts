
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("--- Checking OpenRouter Configuration ---")

    const settings = await prisma.setting.findMany({
        where: {
            key: { in: ['openrouter_api_key', 'openrouter_model', 'ai_provider'] }
        }
    })

    const apiKey = settings.find((s: any) => s.key === 'openrouter_api_key')
    const model = settings.find((s: any) => s.key === 'openrouter_model')
    const provider = settings.find((s: any) => s.key === 'ai_provider')

    if (provider) console.log(`Active Provider: ${provider.value}`)
    else console.log("Active Provider: Not set (defaulting to venice)")

    if (model) console.log(`Model: ${model.value}`)
    else console.log("Model: Not set (using default)")

    if (apiKey && apiKey.value) {
        const masked = apiKey.value.substring(0, 8) + "..." + apiKey.value.substring(apiKey.value.length - 4)
        console.log(`✅ API Key: FOUND (${masked})`)
    } else {
        console.error("❌ API Key: MISSING")
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
