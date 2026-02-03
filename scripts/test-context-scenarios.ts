/**
 * Test scenarios multiples pour vérifier l'équilibre Context vs Conversation
 */

import { director } from '../lib/director'
import { prisma } from '../lib/prisma'

// Import dynamique de Venice pour le test
const { venice } = require('../lib/venice')

async function runScenario(
    agentId: string,
    contact: any,
    settingsMap: any,
    scenarioName: string,
    mockTime: Date,
    userMessage: string
) {
    console.log(`\n\n🔷 SCÉNARIO: ${scenarioName}`)
    console.log(`   🕒 Heure simulée: ${mockTime.toLocaleTimeString('fr-FR')}`)
    console.log(`   👤 User: "${userMessage}"`)

    // 1. Build Prompt with Mock Time
    const systemPrompt = await director.buildSystemPrompt(
        settingsMap,
        contact,
        'CONNECTION',
        { signals: [], signalCount: 0 },
        'Tu es une ado de 15 ans, cool et naturelle.',
        agentId,
        'Test Reason',
        mockTime // <--- Injection de l'heure simulée
    )

    // Log context match for debug
    const contextMatch = systemPrompt.match(/\[CONTEXTE VIE ACTUEL -[^\]]+\]:[^\n]*/)
    console.log(`   📝 Contexte: ${contextMatch ? contextMatch[0].substring(0, 100) + '...' : '❌ NON TROUVÉ'}`)

    // 2. Call LLM
    try {
        const apiKey = settingsMap['venice_api_key']
        if (!apiKey) {
            console.log('   ❌ SKIPPED: Pas de clé API Venice configuée')
            return
        }

        /* console.log('   🤖 Génération en cours...') */
        const response = await venice.chatCompletion(
            systemPrompt,
            [],
            userMessage,
            { apiKey, temperature: 0.7, max_tokens: 150 }
        )

        console.log(`   🤖 ANNA: "${response}"`)
        return response
    } catch (e) {
        console.error('   ❌ Erreur LLM:', e)
    }
}

async function runTests() {
    console.log('═'.repeat(80))
    console.log('🧪 TEST MULTI-SCÉNARIOS: CONTEXTE vs CONVERSATION')
    console.log('═'.repeat(80))

    const agent = await prisma.agent.findFirst({ where: { name: { contains: 'anaïs', mode: 'insensitive' } } })
    if (!agent) return console.log('❌ Agent not found')

    let contact = await prisma.contact.findFirst({ where: { phone_whatsapp: '+33699999999' } })
    if (!contact) {
        contact = await prisma.contact.create({ data: { phone_whatsapp: '+33699999999', name: 'TestUser', source: 'test' } })
    }

    const settings = await prisma.setting.findMany()
    const settingsMap: Record<string, string> = {}
    settings.forEach(s => { settingsMap[s.key] = s.value })

    // DATES SIMULÉES
    const today = new Date()

    // NUIT (03:00) -> Doit dormir
    const dateNight = new Date(today); dateNight.setHours(3, 15, 0, 0)

    // COURS (10:00 Mardi) -> Doit être en cours
    const dateClass = new Date(today); dateClass.setDate(today.getDate() + (2 - today.getDay())); // Force Mardi
    dateClass.setHours(10, 0, 0, 0)

    // SOIRÉE (21:00) -> Disponible / Cool
    const dateEvening = new Date(today); dateEvening.setHours(21, 0, 0, 0)


    // --- TESTS ---

    // 1. NUIT - Question Contextuelle
    await runScenario(agent.id, contact, settingsMap,
        "NUIT - 'Tu fais quoi ?'",
        dateNight,
        "Tu fais quoi ?"
    )

    // 2. NUIT - Conversation Normale (Doit répondre mais rester endormie/brève)
    await runScenario(agent.id, contact, settingsMap,
        "NUIT - Sujet Random (Rap)",
        dateNight,
        "T'aimes bien Ninho ?"
    )

    // 3. COURS - Demande Photo (Refus contexte)
    await runScenario(agent.id, contact, settingsMap,
        "COURS - Demande Photo",
        dateClass,
        "Envoie une photo de toi stp"
    )

    // 4. COURS - Conversation (Réponse discrète)
    await runScenario(agent.id, contact, settingsMap,
        "COURS - Question simple",
        dateClass,
        "C'est quoi ta couleur préférée ?"
    )

    // 5. SOIRÉE - Conversation Normale (Full énergie)
    await runScenario(agent.id, contact, settingsMap,
        "SOIRÉE - Chill",
        dateEvening,
        "Wesh ça raconte quoi ?"
    )

    await prisma.$disconnect()
}

runTests().catch(console.error)
