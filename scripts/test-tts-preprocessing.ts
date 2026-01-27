import { voiceTtsService } from '../lib/voice-tts'
import { settingsService } from '../lib/settings-cache'

async function main() {
    console.log('🧪 TTS PREPROCESSING TEST\n')
    console.log('='.repeat(60))

    // Test phrases
    const testsFR = [
        "Je suis contente de te parler",
        "Je ne sais pas ce que tu veux dire",
        "C'est parce que je t'aime bien",
        "Tu es vraiment gentil avec moi 😊",
        "Il y a quelque chose que je veux te dire"
    ]

    const testsEN = [
        "I am going to tell you something",
        "I don't know what you want to do",
        "I want to talk to you about this",
        "You are really nice to me 😊",
        "I am kind of nervous right now"
    ]

    await settingsService.getSettings() // Initialize

    console.log('\n📘 FRENCH PREPROCESSING\n')
    for (const text of testsFR) {
        console.log(`Original: "${text}"`)
        const result = await voiceTtsService.preprocessForVocal(text, 'fr-FR')
        console.log(`Vocal:    "${result}"`)
        console.log('')
    }

    console.log('='.repeat(60))
    console.log('\n📗 ENGLISH PREPROCESSING\n')
    for (const text of testsEN) {
        console.log(`Original: "${text}"`)
        const result = await voiceTtsService.preprocessForVocal(text, 'en-US')
        console.log(`Vocal:    "${result}"`)
        console.log('')
    }

    console.log('='.repeat(60))
    console.log('✅ Test complete')
}

main().catch(console.error)
