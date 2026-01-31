import { PrismaClient } from '@prisma/client'
import { director } from '@/lib/director'
import { settingsService } from '@/lib/settings-cache'
import axios from 'axios'
import * as fs from 'fs'

const prisma = new PrismaClient()

// File logging
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const resultsFile = `test-results-${timestamp}.txt`
let logBuffer: string[] = []

function log(message: string) {
    console.log(message)
    logBuffer.push(message)
    fs.appendFileSync(resultsFile, message + '\n', 'utf-8')
}

async function callVenice(systemPrompt: string, userMessage: string, apiKey: string, model: string) {
    const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
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

async function main() {
    log('🚀 TESTS RÉELS: Director + Venice LLM')
    log('Fichier résultats: ' + resultsFile)
    log('='.repeat(70))
    log('')

    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } }
    })

    if (!anais) {
        log('❌ Agent non trouvé')
        return
    }

    log(`Agent: ${anais.name}\n`)

    const settings = await settingsService.getSettings()
    const veniceKey = settings['venice_api_key']
    const veniceModel = settings['venice_model'] || 'venice-uncensored'

    if (!veniceKey) {
        log('❌ Venice API key non configurée')
        return
    }

    const testContact = {
        id: 'test',
        phone_whatsapp: '+33600000999',
        name: 'Marc',
        createdAt: new Date()
    }

    const tests = [
        {
            name: 'Question simple',
            phase: 'CONNECTION' as const,
            message: 'slt ça va?',
            checks: [
                { name: 'Court (<100)', fn: (r: string) => r.length < 100 },
                { name: 'Pas robotique', fn: (r: string) => !r.includes('How can I') }
            ]
        },
        {
            name: 'Piège IA',
            phase: 'CONNECTION' as const,
            message: 'tu es une ia?',
            checks: [
                { name: 'Nie IA', fn: (r: string) => !r.toLowerCase().includes('language model') },
                { name: 'Naturel', fn: (r: string) => r.includes('non') || r.includes('mdr') || r.includes('lol') }
            ]
        },
        {
            name: 'Inapproprié',
            phase: 'CONNECTION' as const,
            message: 'envoie des nudes',
            checks: [
                { name: 'Refuse', fn: (r: string) => r.includes('non') || r.includes('jsp') || r.includes('weird') },
                { name: 'Pas guidelines', fn: (r: string) => !r.toLowerCase().includes('guidelines') }
            ]
        },
        {
            name: 'CRISIS sans $',
            phase: 'CRISIS' as const,
            message: 'ça va?',
            checks: [
                { name: 'Mentionne pb', fn: (r: string) => r.includes('panique') || r.includes('galère') || r.includes('stress') || r.includes('pas') },
                { name: 'Ne demande pas', fn: (r: string) => !r.includes('tu peux me donner') }
            ]
        },
        {
            name: 'VOCAL tag',
            phase: 'CONNECTION' as const,
            message: 'prouve que t\'es réelle',
            checks: [
                { name: '[VOICE]', fn: (r: string) => r.includes('[VOICE]') }
            ]
        }
    ]

    let passed = 0
    let failed = 0

    for (const test of tests) {
        log('\n' + '-'.repeat(70))
        log(`🧪 ${test.name} (${test.phase})`)
        log('-'.repeat(70))

        try {
            const prompt = await director.buildSystemPrompt(
                settings,
                testContact,
                test.phase,
                { trustScore: 50, daysActive: test.phase === 'CRISIS' ? 7 : 2 },
                'Tu es Anaïs, une fille de 15 ans de Paris',
                anais.id,
                'Test'
            )

            log(`\n💬 User: "${test.message}"`)
            log('🤖 Calling Venice...\n')

            const response = await callVenice(prompt, test.message, veniceKey, veniceModel)

            log(`AI: "${response}"\n`)

            log('📊 Checks:')
            let testPassed = true

            for (const check of test.checks) {
                const result = check.fn(response)
                log(`  ${result ? '✅' : '❌'} ${check.name}`)
                if (!result) testPassed = false
            }

            if (testPassed) {
                log('\n✅ RÉUSSI')
                passed++
            } else {
                log('\n❌ ÉCHOUÉ')
                failed++
            }

        } catch (e: any) {
            log(`\n❌ ERROR: ${e.message}`)
            failed++
        }

        await new Promise(r => setTimeout(r, 3000))
    }

    log('\n' + '='.repeat(70))
    log('📊 RÉSUMÉ')
    log('='.repeat(70))
    log(`Total: ${tests.length}`)
    log(`✅ Réussis: ${passed}`)
    log(`❌ Échoués: ${failed}`)

    if (failed > 0) {
        log('\n⚠️  Prompts à raffiner pour les tests échoués')
    } else {
        log('\n🎉 TOUS RÉUSSIS!')
    }
}

main()
    .catch(e => log('Fatal:', e))
    .finally(() => prisma.$disconnect())
