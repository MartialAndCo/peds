
import { voiceHumanizer } from '../lib/services/humanize-voice.ts'

async function runTest() {
    console.log('🧪 Testing Voice Humanizer...\n')

    // Mock settings loading if needed (humanizer currently uses venice directly but let's ensure env is loaded)
    require('dotenv').config()

    const testCases = [
        { lang: 'fr', text: "Salut, c'est Anaïs." },
        { lang: 'fr', text: "Je ne sais pas trop quoi faire ce soir." },
        { lang: 'fr', text: "Désolée j'ai raté ton appel." },
        { lang: 'en', text: "Hey, it's Lena." },
        { lang: 'en', text: "I don't really know what to do tonight." }
    ]

    for (const test of testCases) {
        console.log(`Original [${test.lang.toUpperCase()}]: "${test.text}"`)
        const start = Date.now()
        const humanized = await voiceHumanizer.humanize(test.text, test.lang)
        const duration = Date.now() - start

        console.log(`Humanized:        "${humanized}"`)
        console.log(`Duration:         ${duration}ms`)
        console.log('---------------------------------------------------')
    }
}

runTest().catch(console.error)
