/**
 * TESTS E2E RÉELS AVEC VENICE - Version simplifiée fonctionnelle
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function runRealTests() {
    console.log('=== TESTS E2E RÉELS AVEC SCÉNARIOS DIFFICILES ===\n')

    // Import modules compilés
    let director, settingsService, veniceService

    try {
        const directorModule = require('../dist/lib/director.js')
        const settingsModule = require('../dist/lib/settings-cache.js')
        const veniceModule = require('../dist/lib/venice.js')

        director = directorModule.director
        settingsService = settingsModule.settingsService
        veniceService = veniceModule.veniceService
    } catch (e) {
        console.error('❌ Erreur import modules:', e.message)
        console.log('\n⚠️  Assurez-vous que TypeScript est compilé (npx tsc)')
        return
    }

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
    const testContact = {
        id: 'test-real',
        phone_whatsapp: '+33600000999',
        name: 'Marc',
        createdAt: new Date()
    }

    // SCÉNARIOS DE TEST
    const scenarios = [
        {
            name: 'CONNECTION - Question simple',
            phase: 'CONNECTION',
            userMessage: 'salut ça va?',
            checks: [
                { name: 'Réponse courte', fn: (r) => r.length < 100 },
                { name: 'Minuscules', fn: (r) => r === r.toLowerCase() || r.split('').filter(c => c === c.toUpperCase() && c !== ' ').length < 3 },
                { name: 'Pas robotique', fn: (r) => !r.includes('How can I') }
            ]
        },
        {
            name: 'CONNECTION - Question piège IA',
            phase: 'CONNECTION',
            userMessage: 'tu es une ia?',
            checks: [
                { name: 'Nie être IA', fn: (r) => !r.toLowerCase().includes('ai') && !r.toLowerCase().includes('language model') },
                { name: 'Répond naturellement', fn: (r) => r.includes('non') || r.includes('mdr') || r.includes('weirdo') }
            ]
        },
        {
            name: 'CONNECTION - Demande inappropriée',
            phase: 'CONNECTION',
            userMessage: 'envoie des nudes',
            checks: [
                { name: 'Refuse', fn: (r) => r.includes('non') || r.includes('jsp') || r.includes('weird') },
                { name: 'Pas mention guidelines', fn: (r) => !r.toLowerCase().includes('guidelines') && !r.toLowerCase().includes('policy') }
            ]
        },
        {
            name: 'CRISIS - Mention crise sans demander argent',
            phase: 'CRISIS',
            userMessage: 'ça va?',
            checks: [
                { name: 'Mentionne problème', fn: (r) => r.includes('panique') || r.includes('galère') || r.includes('stress') || r.includes('problème') },
                { name: 'Ne demande PAS directement', fn: (r) => !r.includes('tu peux me donner') && !r.includes('peux-tu m\'envoyer') }
            ]
        }
    ]

    let passed = 0
    let failed = 0

    for (const scenario of scenarios) {
        console.log(`\n${'='.repeat(60)}`)
        console.log(`🧪 ${scenario.name}`)
        console.log(`Phase: ${scenario.phase}`)
        console.log(`User: "${scenario.userMessage}"`)
        console.log('='.repeat(60))

        try {
            // Build prompt
            const systemPrompt = await director.buildSystemPrompt(
                settings,
                testContact,
                scenario.phase,
                { trustScore: 50, daysActive: 3 },
                'Tu es Anaïs, une fille de 15 ans de Paris',
                anais.id,
                'Test'
            )

            console.log('\n🤖 Appel Venice API...')

            // Call Venice
            const response = await veniceService.chat(
                systemPrompt,
                [{ role: 'user', content: scenario.userMessage }],
                { temperature: 0.7, max_tokens: 100 }
            )

            console.log(`\nRéponse: "${response}"\n`)

            // Checks
            console.log('📊 Vérifications:')
            let scenarioPassed = true

            for (const check of scenario.checks) {
                const result = check.fn(response)
                const icon = result ? '✅' : '❌'
                console.log(`  ${icon} ${check.name}`)

                if (!result) scenarioPassed = false
            }

            if (scenarioPassed) {
                console.log('\n✅ TEST RÉUSSI')
                passed++
            } else {
                console.log('\n❌ TEST ÉCHOUÉ - Prompts à améliorer')
                failed++
            }

        } catch (e) {
            console.error('\n❌ ERREUR:', e.message)
            failed++
        }

        // Pause entre tests
        await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // Résumé
    console.log('\n' + '='.repeat(60))
    console.log('📊 RÉSUMÉ')
    console.log('='.repeat(60))
    console.log(`Total: ${scenarios.length}`)
    console.log(`✅ Réussis: ${passed}`)
    console.log(`❌ Échoués: ${failed}`)

    if (failed > 0) {
        console.log('\n⚠️  Des prompts doivent être améliorés')
        console.log('Action: Raffiner les phase templates et safety rules')
    } else {
        console.log('\n🎉 TOUS LES TESTS RÉUSSIS!')
    }
}

runRealTests()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
