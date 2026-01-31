import { messageValidator } from '../lib/services/message-validator'

async function testValidator() {
    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║           TEST VALIDATOR - TAGS FONCTIONNELS                   ║')
    console.log('╚════════════════════════════════════════════════════════════════╝\n')

    const tests = [
        {
            name: 'Conservation [VOICE]',
            raw: '[VOICE] hey what\'s up how are you doing today',
            expected: 'Doit CONSERVER [VOICE] et découper le message'
        },
        {
            name: 'Conservation [IMAGE:...]',
            raw: '[IMAGE:selfie] here you go! hope you like it',
            expected: 'Doit CONSERVER [IMAGE:selfie]'
        },
        {
            name: 'Conservation [PAYMENT_RECEIVED] + enlever bold',
            raw: '**[PAYMENT_RECEIVED]** omg thank you so much 💖',
            expected: 'Doit CONSERVER [PAYMENT_RECEIVED] et enlever bold'
        },
        {
            name: 'Enlever brackets aléatoires [smiles]',
            raw: 'okay cool [smiles] thank you [laughs]',
            expected: 'Doit ENLEVER [smiles] et [laughs]'
        },
        {
            name: 'PayPal format robotique',
            raw: 'paypal: lena9200',
            expected: 'Doit harmoniser en "lena9200"'
        }
    ]

    const history = [
        { sender: 'user' as const, text: 'hey' },
        { sender: 'ai' as const, text: 'hi' }
    ]

    for (const test of tests) {
        console.log(`\n${'━'.repeat(70)}`)
        console.log(`🧪 ${test.name}`)
        console.log(`${'━'.repeat(70)}`)
        console.log(`\n📝 RAW:\n   "${test.raw}"`)
        console.log(`\n🎯 ATTENDU:\n   ${test.expected}`)

        try {
            // Try AI validator first
            let cleaned = test.raw
            try {
                cleaned = await messageValidator.validateAndClean(
                    test.raw,
                    history,
                    'test message'
                )
                console.log(`\n✅ AI VALIDATOR:\n   "${cleaned}"`)
            } catch (error: any) {
                console.log(`\n⚠️  AI validator failed (${error.message}), using mechanical...`)
                cleaned = messageValidator.mechanicalClean(test.raw, 'test message')
                console.log(`\n✅ MECHANICAL:\n   "${cleaned}"`)
            }

            // Check if functional tags preserved
            const functionalTags = ['[VOICE]', '[IMAGE:', '[VIDEO:', '[REACT:', '[PAYMENT_RECEIVED]']
            const preservedTags: string[] = []
            functionalTags.forEach(tag => {
                if (test.raw.includes(tag) && cleaned.includes(tag)) {
                    preservedTags.push(tag)
                }
            })

            if (preservedTags.length > 0) {
                console.log(`\n✓ Tags conservés: ${preservedTags.join(', ')}`)
            }

            // Check if random brackets removed
            const randomBrackets = test.raw.match(/\[(?!VOICE\]|IMAGE:|VIDEO:|REACT:|PAYMENT_RECEIVED\])[^\]]+\]/g)
            if (randomBrackets) {
                const stillThere = randomBrackets.filter(b => cleaned.includes(b))
                if (stillThere.length === 0) {
                    console.log(`✓ Brackets aléatoires enlevés: ${randomBrackets.join(', ')}`)
                } else {
                    console.log(`❌ Brackets encore présents: ${stillThere.join(', ')}`)
                }
            }

            // Check bold removed
            if (test.raw.includes('**') && !cleaned.includes('**')) {
                console.log(`✓ Bold enlevé`)
            }

            // Check PayPal harmonization
            if (test.raw.includes('paypal:') && !cleaned.includes('paypal:')) {
                console.log(`✓ PayPal harmonisé`)
            }

        } catch (error: any) {
            console.error(`\n❌ FAILED: ${error.message}`)
        }
    }

    console.log(`\n\n${'═'.repeat(70)}`)
    console.log(`✅ Tests terminés\n`)
}

testValidator().catch(console.error)
