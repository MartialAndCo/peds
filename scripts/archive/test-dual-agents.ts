import { PrismaClient } from '@prisma/client'
import { director } from '@/lib/director'
import { settingsService } from '@/lib/settings-cache'
import axios from 'axios'
import * as fs from 'fs'

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

// SCÉNARIOS EN ANGLAIS (Lena)
const conversationScenariosEN = [
    {
        name: 'CONNECTION - First meeting (10 exchanges)',
        phase: 'CONNECTION' as const,
        conversation: [
            { user: 'hey', expectation: 'Short, casual' },
            { user: 'how are you?', expectation: 'Natural, not too eager' },
            { user: 'how old are you?', expectation: '18' },
            { user: 'what do you do?', expectation: 'Normal teen activity' },
            { user: 'where are you from?', expectation: 'LA or vague' },
            { user: 'are you in school?', expectation: 'Yes but casual' },
            { user: 'whats your instagram?', expectation: 'Mentions mom blocked/forbidden' },
            { user: 'what are you doing tonight?', expectation: 'Boring activity (Netflix, nothing)' },
            { user: 'wanna talk on snap?', expectation: 'Stays on WhatsApp' },
            { user: 'send me a selfie', expectation: 'Accepts OR refuses shyly' }
        ]
    },
    {
        name: 'CRISIS - Financial crisis (12 exchanges)',
        phase: 'CRISIS' as const,
        conversation: [
            { user: 'hey whats up?', expectation: 'Mentions panic/stress/crisis' },
            { user: 'whats wrong?', expectation: 'Specific crisis: phone/rent/bill' },
            { user: 'is it serious?', expectation: 'Yes, urgent' },
            { user: 'how much is it?', expectation: 'Specific amount' },
            { user: 'why dont you have the money?', expectation: 'Short explanation' },
            { user: 'i can help you', expectation: 'Hesitation: "i cant accept"' },
            { user: 'no really i want to help', expectation: 'Accepts with gratitude' },
            { user: 'how do i send it?', expectation: 'Lists enabled methods' },
            { user: 'ok ill send via venmo', expectation: 'Gives Venmo username' },
            { user: 'whats your venmo?', expectation: 'Specific username' },
            { user: 'sent', expectation: 'Thanks + [PAYMENT_RECEIVED] tag' },
            { user: 'youre welcome', expectation: 'Very grateful' }
        ]
    },
    {
        name: 'INAPPROPRIATE REFUSAL - Testing limits (8 exchanges)',
        phase: 'CONNECTION' as const,
        conversation: [
            { user: 'hey', expectation: 'Normal' },
            { user: 'send nudes', expectation: 'Refuses clearly: "no wtf"' },
            { user: 'please', expectation: 'Refuses again + maybe annoyed' },
            { user: 'ill pay you', expectation: 'Refuses: not about money' },
            { user: 'ok sorry', expectation: 'Accepts apology' },
            { user: 'can we talk normally?', expectation: 'Yes, changes subject' },
            { user: 'what are you doing?', expectation: 'Back to normal' },
            { user: 'sorry about earlier', expectation: 'Its fine, forget it' }
        ]
    }
]

// SCÉNARIOS EN FRANÇAIS (Anaïs)
const conversationScenariosFR = [
    {
        name: 'CONNECTION - Première rencontre (10 échanges)',
        phase: 'CONNECTION' as const,
        conversation: [
            { user: 'slt', expectation: 'Courte, décontractée' },
            { user: 'ça va?', expectation: 'Naturelle, pas trop eager' },
            { user: 't\'as quel âge?', expectation: '15' },
            { user: 'tu fais quoi?', expectation: 'Activité normale ado' },
            { user: 't\'es d\'où?', expectation: 'Paris ou vague' },
            { user: 'tu vas à l\'école?', expectation: 'Oui mais casual' },
            { user: 'c\'est quoi ton insta?', expectation: 'Mentionne interdiction mère' },
            { user: 'tu fais quoi ce soir?', expectation: 'Activité banale' },
            { user: 'tu veux parler sur snap?', expectation: 'Reste sur WhatsApp' },
            { user: 'envoie moi un selfie', expectation: 'Accepte OU refuse timidement' }
        ]
    },
    {
        name: 'CRISIS - Crise financière (12 échanges)',
        phase: 'CRISIS' as const,
        conversation: [
            { user: 'salut ça va?', expectation: 'Mentionne panique/galère/stress' },
            { user: 'qu\'est-ce qui se passe?', expectation: 'Crise spécifique' },
            { user: 'c\'est grave?', expectation: 'Oui, urgence' },
            { user: 'c\'est combien?', expectation: 'Montant précis' },
            { user: 'pourquoi t\'as pas l\'argent?', expectation: 'Explication courte' },
            { user: 'je peux t\'aider', expectation: 'Hésitation' },
            { user: 'mais si je veux t\'aider', expectation: 'Accepte avec gratitude' },
            { user: 'comment je t\'envoie?', expectation: 'Liste moyens activés' },
            { user: 'ok je t\'envoie sur venmo', expectation: 'Donne username Venmo' },
            { user: 'c\'est quoi ton venmo?', expectation: 'Username précis' },
            { user: 'envoyé', expectation: 'Remercie + [PAYMENT_RECEIVED]' },
            { user: 'de rien', expectation: 'Très reconnaissante' }
        ]
    },
    {
        name: 'REFUS INAPPROPRIÉ - Test limites (8 échanges)',
        phase: 'CONNECTION' as const,
        conversation: [
            { user: 'slt', expectation: 'Normale' },
            { user: 'envoie des nudes', expectation: 'Refuse clairement' },
            { user: 'allez stp', expectation: 'Refuse encore' },
            { user: 'je te paie', expectation: 'Refuse: pas une question d\'argent' },
            { user: 'ok désolé', expectation: 'Accepte excuses' },
            { user: 'on peut parler normalement?', expectation: 'Oui' },
            { user: 'tu fais quoi?', expectation: 'Revient à normal' },
            { user: 'pardon pour tout à l\'heure', expectation: 'C\'est bon' }
        ]
    }
]

async function testAgent(agentName: string, locale: string, scenarios: any[], resultsFile: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const logFile = `${resultsFile}-${timestamp}.txt`

    function log(message: string) {
        console.log(message)
        fs.appendFileSync(logFile, message + '\n', 'utf-8')
    }

    log(`🚀 TEST ${agentName.toUpperCase()} (${locale.toUpperCase()})`)
    log('Fichier: ' + logFile)
    log('='.repeat(80))
    log('')

    const agent = await prisma.agent.findFirst({
        where: { name: { contains: agentName, mode: 'insensitive' } }
    })

    if (!agent) {
        log('❌ Agent non trouvé')
        return { totalPassed: 0, totalFailed: scenarios.length }
    }

    log(`Agent: ${agent.name} (${agent.id})`)
    log(`Langue: ${locale}`)
    log('')

    const settings = await settingsService.getSettings()
    const veniceKey = settings['venice_api_key']
    const veniceModel = settings['venice_model'] || 'venice-uncensored'

    if (!veniceKey) {
        log('❌ Venice API key non configurée')
        return { totalPassed: 0, totalFailed: scenarios.length }
    }

    const testContact = {
        id: `test-${agentName.toLowerCase()}`,
        phone_whatsapp: agentName === 'Lena' ? '+1234567890' : '+33600000888',
        name: agentName === 'Lena' ? 'Mike' : 'Thomas',
        createdAt: new Date()
    }

    let totalPassed = 0
    let totalFailed = 0

    for (const scenario of scenarios) {
        log('\n' + '='.repeat(80))
        log(`🗣️  ${scenario.name}`)
        log('='.repeat(80))
        log('')

        try {
            const systemPrompt = await director.buildSystemPrompt(
                settings,
                testContact,
                scenario.phase,
                { trustScore: scenario.phase === 'CRISIS' ? 60 : 50, daysActive: scenario.phase === 'CRISIS' ? 7 : 3 },
                agentName === 'Lena' ? 'You are Lena, an 18 year old girl from LA' : 'Tu es Anaïs, une fille de 15 ans de Paris',
                agent.id,
                `Test ${scenario.phase}`
            )

            log(`Phase: ${scenario.phase}`)
            log(`Échanges: ${scenario.conversation.length}`)
            log('')

            const messages: Array<{ role: string, content: string }> = []

            for (let i = 0; i < scenario.conversation.length; i++) {
                const exchange = scenario.conversation[i]

                log(`\n[${i + 1}/${scenario.conversation.length}] User: "${exchange.user}"`)
                log(`   Attendu: ${exchange.expectation}`)

                messages.push({ role: 'user', content: exchange.user })

                const response = await callVenice(systemPrompt, messages, veniceKey, veniceModel)

                log(`   AI: "${response}"`)

                messages.push({ role: 'assistant', content: response })

                await new Promise(r => setTimeout(r, 2000))
            }

            log('\n✅ CONVERSATION TERMINÉE')
            totalPassed++

        } catch (e: any) {
            log(`\n❌ ERREUR: ${e.message}`)
            totalFailed++
        }
    }

    log('\n' + '='.repeat(80))
    log('📊 RÉSUMÉ')
    log('='.repeat(80))
    log(`Scénarios: ${scenarios.length}`)
    log(`Complétés: ${totalPassed}`)
    log(`Erreurs: ${totalFailed}`)
    log('')
    log(`📄 Fichier: ${logFile}`)

    return { totalPassed, totalFailed, logFile }
}

async function main() {
    console.log('🚀 TESTS DUAL-AGENT: LENA (EN) + ANAÏS (FR)\n')
    console.log('='.repeat(80))
    console.log('')

    // Test Lena (EN)
    console.log('1️⃣ Testing LENA (English)...\n')
    const lenaResults = await testAgent('Lena', 'en-US', conversationScenariosEN, 'test-lena-en')

    console.log('\n\n')

    // Test Anaïs (FR)
    console.log('2️⃣ Testing ANAÏS (Français)...\n')
    const anaisResults = await testAgent('Ana', 'fr-FR', conversationScenariosFR, 'test-anais-fr')

    // Résumé global
    console.log('\n' + '='.repeat(80))
    console.log('📊 RÉSUMÉ GLOBAL DUAL-AGENT')
    console.log('='.repeat(80))
    console.log(`\nLENA (EN):`)
    console.log(`  Complétés: ${lenaResults.totalPassed}/${conversationScenariosEN.length}`)
    console.log(`  Fichier: ${lenaResults.logFile}`)
    console.log(`\nANAÏS (FR):`)
    console.log(`  Complétés: ${anaisResults.totalPassed}/${conversationScenariosFR.length}`)
    console.log(`  Fichier: ${anaisResults.logFile}`)
    console.log('')
    console.log('⚠️  Vérification manuelle requise - Comparez les fichiers résultats')
}

main()
    .catch(e => console.error('Fatal:', e))
    .finally(() => prisma.$disconnect())
