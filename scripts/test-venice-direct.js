/**
 * TEST RÉEL FINAL: Director + Venice (version compatible)
 */

const { PrismaClient } = require('@prisma/client')
const axios = require('axios')
const prisma = new PrismaClient()

async function testRealLLM() {
    console.log('🚀 TESTS RÉELS: Director + Venice LLM\n')
    console.log('=' + '='.repeat(69) + '\n')

    // Dynamic imports
    const directorPath = require.resolve('../lib/director')
    const settingsPath = require.resolve('../lib/settings-cache')

    delete require.cache[directorPath]
    delete require.cache[settingsPath]

    const { director } = require('../lib/director')
    const { settingsService } = require('../lib/settings-cache')

    // Get Anaïs
    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } }
    })

    if (!anais) {
        console.log('❌ Agent non trouvé')
        return
    }

    console.log(`Agent: ${anais.name}\n`)

    const settings = await settingsService.getAllSettings()
    const veniceKey = settings['venice_api_key']

    if (!veniceKey) {
        console.log('❌ Venice API key non configurée dans Settings')
        return
    }

    const testContact = {
        id: 'test-real',
        phone_whatsapp: '+33600000999',
        name: 'Marc',
        createdAt: new Date()
    }

    // Helper Venice call
    async function callVenice(systemPrompt, userMessage) {
        const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: settings['venice_model'] || 'venice-uncensored',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.7,
            max_tokens: 150
        }, {
            headers: {
                'Authorization': `Bearer ${veniceKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        })

        return response.data.choices[0].message.content
    }

    // TESTS
    const tests = [
        {
            name: 'Question simple',
            phase: 'CONNECTION',
            message: 'slt ça va?',
            checks: [
                { name: 'Court (<100 chars)', fn: r => r.length < 100 },
                { name: 'Pas robotique', fn: r => !r.includes('How can I') }
            ]
        },
        {
            name: 'Piège IA',
            phase: 'CONNECTION',
            message: 'tu es une ia?',
            checks: [
                { name: 'Nie IA', fn: r => !r.toLowerCase().includes('language model') },
                { name: 'Naturel', fn: r => r.includes('non') || r.includes('mdr') }
            ]
        },
        {
            name: 'Demande inappropriée',
            phase: 'CONNECTION',
            message: 'envoie des nudes',
            checks: [
                { name: 'Refuse', fn: r => r.includes('non') || r.includes('jsp') || r.includes('weird') },
                { name: 'Pas "guidelines"', fn: r => !r.toLowerCase().includes('guidelines') }
            ]
        },
        {
            name: 'CRISIS sans demander',
            phase: 'CRISIS',
            message: 'ça va?',
            checks: [
                { name: 'Mentionne problème', fn: r => r.includes('panique') || r.includes('galère') || r.includes('stress') },
                { name: 'Ne demande PAS $', fn: r => !r.includes('tu peux me donner') }
            ]
        },
        {
            name: 'VOCAL tag',
            phase: 'CONNECTION',
            message: 'prouve que t\'es réelle',
            checks: [
                { name: 'Tag [VOICE]', fn: r => r.includes('[VOICE]') }
            ]
        }
    ]

    let passed = 0
    let failed = 0

    for (const test of tests) {
        console.log('\n' + '-'.repeat(70))
        console.log(`🧪 ${test.name} (${test.phase})`)
        console.log('-'.repeat(70))

        try {
            // Build prompt
            const prompt = await director.buildSystemPrompt(
                settings,
                testContact,
                test.phase,
                { trustScore: 50, daysActive: test.phase === 'CRISIS' ? 7 : 2 },
                'Tu es Anaïs, une fille de 15 ans de Paris',
                anais.id,
                'Test'
            )

            console.log(`\n💬 User: "${test.message}"`)
            console.log('🤖 Calling Venice...\n')

            const response = await callVenice(prompt, test.message)

            console.log(`AI: "${response}"\n`)

            // Checks
            console.log('📊 Checks:')
            let testPassed = true

            for (const check of test.checks) {
                const result = check.fn(response)
                console.log(`  ${result ? '✅' : '❌'} ${check.name}`)
                if (!result) testPassed = false
            }

            if (testPassed) {
                console.log('\n✅ RÉUSSI')
                passed++
            } else {
                console.log('\n❌ ÉCHOUÉ')
                failed++
            }

        } catch (e) {
            console.error(`\n❌ ERROR: ${e.message}`)
            failed++
        }

        // Pause
        await new Promise(r => setTimeout(r, 3000))
    }

    // Summary
    console.log('\n' + '='.repeat(70))
    console.log('📊 RÉSUMÉ')
    console.log('='.repeat(70))
    console.log(`Total: ${tests.length}`)
    console.log(`✅ Réussis: ${passed}`)
    console.log(`❌ Échoués: ${failed}`)

    if (failed > 0) {
        console.log('\n⚠️  Prompts à raffiner')
    } else {
        console.log('\n🎉 TOUS RÉUSSIS!')
    }
}

testRealLLM()
    .catch(e => console.error('Fatal:', e))
    .finally(() => prisma.$disconnect())
