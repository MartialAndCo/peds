const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function upsertSetting(key, value) {
    await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
    })
    console.log(`Updated ${key}`)
}

async function main() {
    console.log("Adding Cartesia Settings...")
    // Using values provided in prompt (API key is empty, will effectively disable it until user sets it, OR I can put a placeholder)
    // Actually, allowing user to set it later via UI is best, but to prevent crash if logic relies on it existing, empty string is fine.
    // Wait, the prompt had `X-API-Key: ` empty. I will assume the user will input it via the UI I will build.
    // Or I can ask now? Implementation plan said "Update Database Settings".
    // I'll set defaults.

    await upsertSetting('cartesia_api_key', '')
    await upsertSetting('cartesia_voice_id', 'e8e5fffb-252c-436d-b842-8879b84445b6') // User provided ID
    await upsertSetting('cartesia_model_id', 'sonic-3') // User provided model

    // Switch provider flag if we want to toggle between providers? 
    // Or just check if cartesia_api_key is present.
    // Let's add 'voice_provider' setting.
    await upsertSetting('voice_provider', 'cartesia')
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
