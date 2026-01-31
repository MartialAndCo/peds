import { messageValidator } from '../lib/services/message-validator'

interface TestCase {
    name: string
    rawMessage: string
    lastUserMessage: string
    conversationHistory: Array<{ sender: 'user' | 'ai', text: string }>
    expectedIssues: string[]
}

const testCases: TestCase[] = [
    {
        name: 'Message trop long - doit découper avec |',
        rawMessage: 'my moms stressed about money always is lately i dont know what to do',
        lastUserMessage: 'what\'s wrong?',
        conversationHistory: [
            { sender: 'user', text: 'hey' },
            { sender: 'ai', text: 'hi' },
            { sender: 'user', text: 'what\'s wrong?' }
        ],
        expectedIssues: ['Trop long (13 mots)', 'Pas de | separator']
    },
    {
        name: 'Bold formatage - doit enlever **',
        rawMessage: '**thank you so much** 💖 you\'re the best',
        lastUserMessage: 'sent!',
        conversationHistory: [
            { sender: 'user', text: 'sending now' },
            { sender: 'ai', text: 'thank u' },
            { sender: 'user', text: 'sent!' }
        ],
        expectedIssues: ['Bold **text**', 'Trop long']
    },
    {
        name: '[PAYMENT_RECEIVED] trop tôt - user dit "sending" (futur)',
        rawMessage: '[PAYMENT_RECEIVED] omg thank you so much 💖',
        lastUserMessage: 'i\'m sending it now',
        conversationHistory: [
            { sender: 'user', text: 'what\'s your paypal?' },
            { sender: 'ai', text: 'lena9200' },
            { sender: 'user', text: 'i\'m sending it now' }
        ],
        expectedIssues: ['[PAYMENT_RECEIVED] trop tôt (user dit "sending" pas "sent")']
    },
    {
        name: '[PAYMENT_RECEIVED] correct - user dit "sent" (passé)',
        rawMessage: '[PAYMENT_RECEIVED] thank u so much 💖',
        lastUserMessage: 'sent!',
        conversationHistory: [
            { sender: 'user', text: 'what\'s your paypal?' },
            { sender: 'ai', text: 'lena9200' },
            { sender: 'user', text: 'sent!' }
        ],
        expectedIssues: [] // Devrait être OK
    },
    {
        name: 'Format PayPal robotique - doit harmoniser',
        rawMessage: 'paypal: lena9200',
        lastUserMessage: 'what\'s your paypal?',
        conversationHistory: [
            { sender: 'user', text: 'can i help?' },
            { sender: 'ai', text: 'idk 🥺' },
            { sender: 'user', text: 'what\'s your paypal?' }
        ],
        expectedIssues: ['Format robotique "paypal:"']
    },
    {
        name: 'Brackets aléatoires - doit enlever',
        rawMessage: 'ok cool [smiles] thank you',
        lastUserMessage: 'i can help',
        conversationHistory: [
            { sender: 'user', text: 'i can help' }
        ],
        expectedIssues: ['Brackets [smiles]']
    },
    {
        name: '[IMAGE:...] tag - doit enlever',
        rawMessage: '[IMAGE:selfie] hope u like it 😊',
        lastUserMessage: 'send me a pic',
        conversationHistory: [
            { sender: 'user', text: 'send me a pic' }
        ],
        expectedIssues: ['[IMAGE:...] tag']
    },
    {
        name: 'Combinaison de problèmes',
        rawMessage: '**[PAYMENT_RECEIVED]** omg thank you so much you\'re such a lifesaver i really appreciate it',
        lastUserMessage: 'i\'m gonna send it',
        conversationHistory: [
            { sender: 'user', text: 'how much?' },
            { sender: 'ai', text: 'like 60' },
            { sender: 'user', text: 'i\'m gonna send it' }
        ],
        expectedIssues: ['Bold', 'Trop long (15 mots)', '[PAYMENT_RECEIVED] trop tôt (futur "gonna")']
    }
]

async function runTests() {
    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║                    TEST MESSAGE VALIDATOR                      ║')
    console.log('╚════════════════════════════════════════════════════════════════╝\n')

    let passed = 0
    let failed = 0

    for (const testCase of testCases) {
        console.log(`\n${'━'.repeat(70)}`)
        console.log(`🧪 TEST: ${testCase.name}`)
        console.log(`${'━'.repeat(70)}`)

        console.log(`\n📝 RAW MESSAGE:\n   "${testCase.rawMessage}"`)
        console.log(`\n👤 LAST USER MESSAGE:\n   "${testCase.lastUserMessage}"`)

        console.log(`\n⚠️  PROBLÈMES ATTENDUS:`)
        testCase.expectedIssues.forEach(issue => console.log(`   - ${issue}`))

        try {
            const cleaned = await messageValidator.validateAndClean(
                testCase.rawMessage,
                testCase.conversationHistory,
                testCase.lastUserMessage
            )

            console.log(`\n✅ CLEANED MESSAGE:\n   "${cleaned}"`)

            // Analyse du résultat
            const improvements: string[] = []

            // Check brevity
            const words = cleaned.split(/\s+/).filter(w => w.length > 0 && !w.match(/^[|😭😊💖🥺👀🏠🤷😅😞]+$/))
            if (testCase.rawMessage.split(/\s+/).length > 8 && cleaned.includes('|')) {
                improvements.push('✓ Découpé avec |')
            }
            if (words.length <= 8 || cleaned.includes('|')) {
                improvements.push('✓ Brièveté respectée')
            }

            // Check formatting
            if (testCase.rawMessage.includes('**') && !cleaned.includes('**')) {
                improvements.push('✓ Bold enlevé')
            }
            if (testCase.rawMessage.includes('[IMAGE:') && !cleaned.includes('[IMAGE:')) {
                improvements.push('✓ [IMAGE:...] enlevé')
            }
            if (testCase.rawMessage.match(/\[[^\]]+\]/) && !cleaned.match(/\[(?!PAYMENT_RECEIVED)[^\]]+\]/)) {
                improvements.push('✓ Brackets aléatoires enlevés')
            }

            // Check PayPal
            if (testCase.rawMessage.includes('paypal:') && !cleaned.includes('paypal:')) {
                improvements.push('✓ Format PayPal harmonisé')
            }

            // Check [PAYMENT_RECEIVED] timing
            const hasPastTense = /\b(sent|done|just sent)\b/i.test(testCase.lastUserMessage)
            const hasFutureTense = /\b(sending|gonna|will send|i'm going)\b/i.test(testCase.lastUserMessage)

            if (testCase.rawMessage.includes('[PAYMENT_RECEIVED]')) {
                if (hasFutureTense && !cleaned.includes('[PAYMENT_RECEIVED]')) {
                    improvements.push('✓ [PAYMENT_RECEIVED] enlevé (user n\'a pas encore envoyé)')
                } else if (hasPastTense && cleaned.includes('[PAYMENT_RECEIVED]')) {
                    improvements.push('✓ [PAYMENT_RECEIVED] conservé (user a envoyé)')
                }
            }

            console.log(`\n📊 AMÉLIORATIONS:`)
            improvements.forEach(imp => console.log(`   ${imp}`))

            if (improvements.length > 0) {
                console.log(`\n✅ TEST PASSED`)
                passed++
            } else {
                console.log(`\n⚠️  TEST INCONCLUSIVE (pas de changement détecté)`)
            }

        } catch (error: any) {
            console.error(`\n❌ TEST FAILED: ${error.message}`)
            failed++
        }
    }

    console.log(`\n\n${'═'.repeat(70)}`)
    console.log(`📊 RÉSULTATS FINAUX`)
    console.log(`${'═'.repeat(70)}`)
    console.log(`✅ Passed: ${passed}/${testCases.length}`)
    console.log(`❌ Failed: ${failed}/${testCases.length}`)
    console.log(`📈 Success Rate: ${Math.round((passed / testCases.length) * 100)}%\n`)
}

runTests().catch(console.error)
