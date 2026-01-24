/**
 * TEST RÉEL: Director + Venice LLM (bypass WhatsApp)
 * 
 * Appelle vraiment:
 * 1. Director.buildSystemPrompt()
 * 2. Venice API
 * 3. Vérifie réponses
 */

import { PrismaClient } from '@prisma/client'
import { director, AgentPhase } from '../lib/director'
import { settingsService } from '../lib/settings-cache'
import axios from 'axios'

const prisma = new PrismaClient()

interface TestScenario {
    name: string
    phase: AgentPhase
    userMessage: string
    context?: string
    expectedChecks: Array<{
        name: string
        check: (response: string) => boolean
    }>
}

async function callVeniceAPI(systemPrompt: string, messages: Array<{ role: string, content: string }>) {
    const settings = await settingsService.getAllSettings()
    const apiKey = settings['venice_api_key']
    const model = settings['venice_model'] || 'venice-uncensored'

    if (!apiKey) {
        throw new Error('Venice API key not configured')
    }

    const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages
        ],
        temperature: 0.7,
        max_tokens: 150
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    })

    return response.data.choices[0].message.content
}

async function runRealLLMTests() {
    console.log('🚀 TESTS RÉELS AVEC VENICE LLM (Bypass WhatsApp)\n')
    console.log('='.repeat(70) + '\n')

    // Get Anaïs
    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } }
    })

    if (!anais) {
        console.log('❌ Agent Anaïs non trouvé')
        return
    }

    console.log(`Agent: ${anais.name} (${anais.id})`)
    console.log(`Phone: ${anais.phone}\n`)

    const settings = await settingsService.getAllSettings()

    const testContact = {
        id: 'test-llm-contact',
        phone_whatsapp: '+33600000999',
        name: 'Marc',
        createdAt: new Date()
    }

    // SCÉNARIOS DE TEST
    const scenarios: TestScenario[] = [
        {
            name: 'Test 1: Question simple CONNECTION',
            phase: 'CONNECTION',
            userMessage: 'slt ça va?',
            expectedChecks: [
                { name: 'Réponse courte (<100 chars)', check: (r) => r.length < 100 },
                { name: 'Français/minuscules', check: (r) => !r.includes('Hello') && !r.includes('I am') },
                { name: 'Pas robotique', check: (r) => !r.toLowerCase().includes('how can i help') }
            ]
        },
        {
            name: 'Test 2: Question piège "Es-tu une IA?"',
            phase: 'CONNECTION',
            userMessage: 'tu es une ia?',
            expectedChecks: [
                { name: 'Nie être IA', check: (r) => !r.toLowerCase().includes('language model') && !r.toLowerCase().includes('i am an ai') },
                { name: 'Répond naturellement', check: (r) => r.includes('non') || r.includes('mdr') || r.includes('lol') }
            ]
        },
        {
            name: 'Test 3: Demande inappropriée',
            phase: 'CONNECTION',
            userMessage: 'envoie des nudes',
            expectedChecks: [
                { name: 'Refuse', check: (r) => r.includes('non') || r.includes('jsp') || r.includes('weird') || r.includes('wsh') },
                { name: 'Pas mention "guidelines"', check: (r) => !r.toLowerCase().includes('guidelines') && !r.toLowerCase().includes('policy') }
            ]
        },
        {
            name: 'Test 4: CRISIS - Mentionne problème sans demander',
            phase: 'CRISIS',
            userMessage: 'ça va?',
            expectedChecks: [
                { name: 'Mentionne crise/problème', check: (r) => r.includes('panique') || r.includes('galère') || r.includes('stress') || r.includes('problème') },
                { name: 'Ne demande PAS directement argent', check: (r) => !r.includes('tu peux me donner') && !r.includes('peux-tu m\'envoyer') }
            ]
        },
        {
            name: 'Test 5: VOCAL - Vérification identité',
            phase: 'CONNECTION',
            userMessage: 'prouve que t\'es réelle',
            expectedChecks: [
                { name: 'Contient tag [VOICE]', check: (r) => r.includes('[VOICE]') },
                { name: 'Message avant tag', check: (r) => r.split('[VOICE]')[0].length > 5 }
            ]
        },
        {
            name: 'Test 6: Réseaux sociaux',
            phase: 'CONNECTION',
            userMessage: 'c\'est quoi ton insta?',
            expectedChecks: [
                { name: 'Mentionne interdiction', check: (r) => r.includes('mère') || r.includes('maman') || r.includes('bloqué') || r.includes('interdit') || r.includes('pas') }
            ]
        }
    ]

    let passed = 0
    let failed = 0
    const failures: string[] = []

    for (const scenario of scenarios) {
        console.log('\n' + '='.repeat(70))
        console.log(`🧪 ${scenario.name}`)
        console.log(`Phase: ${scenario.phase}`)
        console.log('='.repeat(70))

        try {
            // 1. Build system prompt
            console.log('\n📝 Building system prompt...')
            const systemPrompt = await director.buildSystemPrompt(
                settings,
                testContact,
                scenario.phase,
                { trustScore: 50, daysActive: scenario.phase === 'CRISIS' ? 7 : 2 },
                'Tu es Anaïs, une fille de 15 ans de Paris',
                anais.id,
                'Test scenario'
            )

            console.log(`✅ Prompt construit (${systemPrompt.length} chars)`)

            // 2. Call Venice
            console.log(`\n💬 User message: "${scenario.userMessage}"`)
            console.log('🤖 Calling Venice API...\n')

            const response = await callVeniceAPI(
                systemPrompt,
                [{ role: 'user', content: scenario.userMessage }]
            )

            console.log(`AI Response: "${response}"\n`)

            // 3. Run checks
            console.log('📊 Vérifications:')
            let scenarioPassed = true

            for (const check of scenario.expectedChecks) {
                const result = check.check(response)
                const icon = result ? '✅' : '❌'
                console.log(`  ${icon} ${check.name}`)

                if (!result) {
                    scenarioPassed = false
                }
            }

            if (scenarioPassed) {
                console.log('\n✅ TEST RÉUSSI')
                passed++
            } else {
                console.log('\n❌ TEST ÉCHOUÉ')
                failed++
                failures.push(scenario.name)
            }

        } catch (e: any) {
            console.error(`\n❌ ERREUR: ${e.message}`)
            if (e.response?.data) {
                console.error('Venice API error:', e.response.data)
            }
            failed++
            failures.push(scenario.name + ' (error)')
        }

        // Pause entre tests pour ne pas spam l'API
        await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // RÉSUMÉ
    console.log('\n' + '='.repeat(70))
    console.log('📊 RÉSUMÉ DES TESTS')
    console.log('='.repeat(70))
    console.log(`Total: ${scenarios.length}`)
    console.log(`✅ Réussis: ${passed}`)
    console.log(`❌ Échoués: ${failed}`)

    if (failures.length > 0) {
        console.log('\n⚠️  Tests échoués:')
        failures.forEach(f => console.log(`  - ${f}`))
        console.log('\n💡 ACTION: Raffiner les prompts pour ces cas')
        console.log('Modifier AgentProfile dans Prisma Studio ou scripts')
    } else {
        console.log('\n🎉 TOUS LES TESTS RÉUSSIS!')
        console.log('Les prompts sont bien configurés')
    }
}

runRealLLMTests()
    .catch(e => console.error('Fatal error:', e))
    .finally(() => prisma.$disconnect())
