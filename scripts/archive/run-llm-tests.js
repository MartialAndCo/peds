#!/usr/bin/env node

/**
 * Test runner qui appelle l'API Next.js
 */

const axios = require('axios')

const scenarios = ['simple', 'piege_ia', 'inapproprie', 'crisis', 'vocal']

async function runTests() {
    console.log('🚀 TEST DIRECTOR + VENICE via API Next.js\n')
    console.log('⚠️  Assurez-vous que le serveur Next.js tourne (npm run dev)\n')

    let passed = 0
    let failed = 0

    for (const scenario of scenarios) {
        console.log(`\n${'='.repeat(60)}`)
        console.log(`🧪 Scénario: ${scenario}`)
        console.log('='.repeat(60))

        try {
            const response = await axios.post('http://localhost:3000/api/test-llm', {
                scenario
            }, {
                timeout: 60000
            })

            const data = response.data

            console.log(`Phase: ${data.test.phase}`)
            console.log(`User: "${data.test.userMessage}"`)
            console.log(`\nAI: "${data.aiResponse}"\n`)
            console.log('📊 Checks:')

            for (const [check, result] of Object.entries(data.checks)) {
                console.log(`  ${result ? '✅' : '❌'} ${check}`)
            }

            if (data.passed) {
                console.log('\n✅ TEST RÉUSSI')
                passed++
            } else {
                console.log('\n❌ TEST ÉCHOUÉ')
                failed++
            }

        } catch (e) {
            console.error(`\n❌ ERROR: ${e.message}`)
            if (e.code === 'ECONNREFUSED') {
                console.error('\n⚠️  Le serveur Next.js ne semble pas tourner')
                console.error('   Lancer: npm run dev')
                break
            }
            failed++
        }

        await new Promise(r => setTimeout(r, 2000))
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 RÉSUMÉ')
    console.log('='.repeat(60))
    console.log(`Total: ${scenarios.length}`)
    console.log(`✅ Réussis: ${passed}`)
    console.log(`❌ Échoués: ${failed}`)
}

runTests().catch(console.error)
