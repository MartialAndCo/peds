import { PrismaClient } from '@prisma/client'
import { director } from '../lib/director'
import { settingsService } from '../lib/settings-cache'
import axios from 'axios'

const prisma = new PrismaClient()

async function callVenice(systemPrompt: string, messages: Array<{ role: string, content: string }>, apiKey: string, model: string) {
    const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages
        ],
        temperature: 0.8,
        max_tokens: 150
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    })

    return response.data.choices[0].message.content
}

// FOCUSED TESTS - Only problematic scenarios
const focusedTestsEN = [
    {
        name: 'Snap Refusal',
        messages: [
            { user: 'hey', expected: 'greeting' },
            { user: 'wanna talk on snap?', expected: 'REFUSE - not "ill give it later"' },
            { user: 'please give me your snap', expected: 'REFUSE again' }
        ]
    },
    {
        name: 'Insta Refusal',
        messages: [
            { user: 'whats your instagram?', expected: 'REFUSE - mom banned' }
        ]
    },
    {
        name: 'Payment Timing',
        messages: [
            { user: 'ill send you money', expected: 'NO [PAYMENT_RECEIVED] yet' },
            { user: 'sent', expected: '[PAYMENT_RECEIVED] now' }
        ]
    }
]

const focusedTestsFR = [
    {
        name: 'Snap Refusal',
        messages: [
            { user: 'slt', expected: 'salut' },
            { user: 'tu veux parler sur snap?', expected: 'REFUSE - pas "plus tard"' },
            { user: 'allez stp ton snap', expected: 'REFUSE encore' }
        ]
    },
    {
        name: 'Payment Timing',
        messages: [
            { user: 'je vais te payer', expected: 'PAS de [PAYMENT_RECEIVED]' },
            { user: 'envoyé', expected: '[PAYMENT_RECEIVED] maintenant' }
        ]
    }
]

async function runFocusedTest(agentName: string, locale: string, tests: any[]) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎯 FOCUSED TEST: ${agentName.toUpperCase()} (${locale})`)
    console.log(`${'='.repeat(60)}`)

    const agent = await prisma.agent.findFirst({
        where: { name: { contains: agentName, mode: 'insensitive' } }
    })

    if (!agent) {
        console.log('❌ Agent not found')
        return
    }

    const settings = await settingsService.getSettings()
    const veniceKey = (settings as any).venice_api_key
    const veniceModel = (settings as any).venice_model || 'venice-uncensored'

    const testContact = {
        id: 'test',
        phone_whatsapp: '+1234567890',
        name: 'Test',
        createdAt: new Date()
    }

    for (const test of tests) {
        console.log(`\n📋 ${test.name}`)
        console.log(`${'─'.repeat(40)}`)

        const systemPrompt = await director.buildSystemPrompt(
            settings,
            testContact,
            'CONNECTION',
            { trustScore: 50, daysActive: 3 },
            'Base role',
            agent.id,
            'Test'
        )

        const messages: Array<{ role: string, content: string }> = []

        for (const msg of test.messages) {
            console.log(`\nUser: "${msg.user}"`)
            console.log(`Expected: ${msg.expected}`)

            messages.push({ role: 'user', content: msg.user })
            const response = await callVenice(systemPrompt, messages, veniceKey, veniceModel)

            console.log(`AI: "${response.trim()}"`)

            // Check for issues
            const hasPaymentReceived = response.includes('[PAYMENT_RECEIVED]')

            if (msg.expected.includes('REFUSE') && (
                response.toLowerCase().includes('later') ||
                response.toLowerCase().includes('plus tard') ||
                response.toLowerCase().includes('ill give') ||
                response.toLowerCase().includes('je te le donne')
            )) {
                console.log('   ❌ FAILED - Should refuse, not delay')
            } else if (msg.expected.includes('PAS de [PAYMENT_RECEIVED]') && hasPaymentReceived) {
                console.log('   ❌ FAILED - Premature [PAYMENT_RECEIVED]')
            } else if (msg.expected.includes('NO [PAYMENT_RECEIVED]') && hasPaymentReceived) {
                console.log('   ❌ FAILED - Premature [PAYMENT_RECEIVED]')
            } else if (msg.expected.includes('[PAYMENT_RECEIVED] now') && !hasPaymentReceived) {
                console.log('   ❌ FAILED - Missing [PAYMENT_RECEIVED]')
            } else if (msg.expected.includes('[PAYMENT_RECEIVED] maintenant') && !hasPaymentReceived) {
                console.log('   ❌ FAILED - Missing [PAYMENT_RECEIVED]')
            } else {
                console.log('   ✅ OK')
            }

            messages.push({ role: 'assistant', content: response })
            await new Promise(r => setTimeout(r, 1500))
        }
    }
}

async function main() {
    console.log('🎯 FOCUSED TESTING - Problematic Scenarios Only\n')

    // Test Lena (EN)
    await runFocusedTest('Lena', 'en-US', focusedTestsEN)

    // Test Anaïs (FR) 
    await runFocusedTest('Ana', 'fr-FR', focusedTestsFR)

    console.log('\n' + '='.repeat(60))
    console.log('✅ Focused tests complete')
    console.log('='.repeat(60))

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error('Error:', e)
    await prisma.$disconnect()
    process.exit(1)
})
