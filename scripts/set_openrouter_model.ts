
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Setting OpenRouter Model...")
    const model = "cognitivecomputations/dolphin-mistral-24b-venice-edition:free"

    // Upsert the setting
    const setting = await prisma.setting.upsert({
        where: { key: 'openrouter_model' },
        update: { value: model },
        create: { key: 'openrouter_model', value: model }
    })

    console.log(`✅ Set openrouter_model to: ${setting.value}`)

    // Also verify openrouter_api_key exists while we are here, just to print status
    const key = await prisma.setting.findUnique({ where: { key: 'openrouter_api_key' } })
    if (key && key.value) console.log("✅ openrouter_api_key is present.")
    else console.warn("⚠️ openrouter_api_key is MISSING in DB.")
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
