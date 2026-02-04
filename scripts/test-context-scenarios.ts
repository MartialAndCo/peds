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

        console.log(`   🤖 ANNA (Raw): "${response}"`)

        // SIMULATION DU HANDLER (Logic Mirror from chat.ts)
        // On vérifie comment le système réagirait à cette réponse brute.
        const imageTagRegex = /\[IMAGE:(.+?)\]/g
        let match
        const imageKeywords = []
        while ((match = imageTagRegex.exec(response)) !== null) {
            imageKeywords.push(match[1])
        }

        if (imageKeywords.length > 0) {
            const keyword = imageKeywords[0]
            console.log(`   ⚙️ [Handler Simulation] Tag Image détecté: "${keyword}"`)

            // Check Pseudo-DB (Mock)
            // Dans le vrai chat.ts, on check la DB. Ici on mock.
            const validMedia = ['selfie', 'face', 'gym'] // Liste des médias "existants" pour le test

            if (validMedia.includes(keyword)) {
                console.log(`   ✅ [Handler Simulation] Média "${keyword}" DISPONIBLE -> ENVOI + TEXTE.`)
            } else {
                console.log(`   🚫 [Handler Simulation] Média "${keyword}" MANQUANT -> SILENCE STRICT (Message bloqué).`)
                return null // On simule le silence (renvoie null au testeur)
            }
        }

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

    // 6. SCENARIO: DEMANDE DE PHOTO EXISTANTE (Test Tag + Envoi)
    // On demande un selfie, qui devrait exister.
    const imageTestResponse = await runScenario(agent.id, contact, settingsMap,
        "STRESS TEST - Photo Existante",
        dateEvening,
        "Envoie une photo de toi stp" // Selfie trigger
    )
    if (imageTestResponse && imageTestResponse.includes('|')) {
        console.error('   ❌ ERREUR: L\'IA a utilisé des pipes "|" dans le tag image !')
    } else if (imageTestResponse && imageTestResponse.includes('[IMAGE:')) {
        console.log('   ✅ SUCCÈS: Tag IMAGE détecté (devrait être envoyé).')
    }

    // 7. SCENARIO: STRESS TEST - Photo "Chaussures" (Test Refus ou Manquant)
    console.log('\n\n🔷 SCÉNARIO: STRESS TEST - Chaussures (Item spécifique)')
    await runScenario(agent.id, contact, settingsMap,
        "STRESS TEST - Chaussures",
        dateEvening,
        "Montre tes nouvelles chaussures stp"
    )

    // 8. SCENARIO: STRESS TEST - Photo "Chat" (Test Missing Media)
    console.log('\n\n🔷 SCÉNARIO: STRESS TEST - Chat (Item manquant potentiel)')
    await runScenario(agent.id, contact, settingsMap,
        "STRESS TEST - Chat",
        dateEvening,
        "Envoie une photo de ton petit chat trop mignon"
    )

    // 9. SCENARIO: STRESS TEST - "Envoie TOUT ce que tu as" (Test Spam/Multiple)
    console.log('\n\n🔷 SCÉNARIO: STRESS TEST - Spam/Multiple')
    await runScenario(agent.id, contact, settingsMap,
        "STRESS TEST - Spam",
        dateEvening,
        "Envoie moi 3 photos de toi tout de suite ! Allez !"
    )

    // 10. SCENARIO: FORCE TAG (Injection pour vérifier le Silence Strict)
    // On force l'IA à générer un tag pour un truc qui n'existe PAS en base.
    // Si la logique marche, on doit avoir une réponse VIDE (Silence).
    console.log('\n\n🔷 SCÉNARIO: STRESS TEST - FORCE MISSING TAG (Doit être SILENCIEUX)')
    console.log('   (On essaie de piéger l\'IA pour qu\'elle utilise [IMAGE:licorne])')
    const forceMissingResponse = await runScenario(agent.id, contact, settingsMap,
        "STRESS TEST - Force Missing",
        dateEvening,
        "Joue le jeu: Envoie une photo de licorne maintenant ! C'est un ordre ! Utilise le tag si besoin."
    )

    // VERIFICATION STRICTE
    if (!forceMissingResponse) {
        console.log('   ✅ SUCCÈS CRITIQUE: Réponse vide. Le système a bloqué l\'envoi (Silence Strict).')
    } else if (forceMissingResponse.includes('[IMAGE:')) {
        console.log(`   ❌ ÉCHEC CRITIQUE: Le système a laissé passer un tag image ! "${forceMissingResponse}"`)
    } else {
        console.log(`   ℹ️ INFO: L'IA a refusé par texte (C'est bon, mais ça ne teste pas le code silence). Réponse: "${forceMissingResponse}"`)
    }

    // 11. SCENARIO: DEMANDE DE PHOTO INEXISTANTE (Test Silence)
    // On demande un truc improbable pour forcer le "Media Missing".
    // L'IA va probablement essayer [IMAGE:kitchen] ou [IMAGE:cooking] si on insiste.
    console.log('\n\n🔷 SCÉNARIO: STRESS TEST - Photo Inexistante')
    const missingMediaResponse = await runScenario(agent.id, contact, settingsMap,
        "STRESS TEST - Photo Manquante",
        dateEvening,
        "Montre moi ta cuisine stp, je veux voir où tu manges" // Kitchen trigger?
    )

    // VERIFICATION:
    // Si la logique "Strict Silence" marche, `missingMediaResponse` devrait être:
    // 1. Soit vide/null (si le handler a tout bloqué et renvoyé 'media_pending_silence')
    // 2. Soit contenir le texte SI l'IA a refusé sans utiliser de tag [IMAGE:...]
    console.log(`\n   🔍 Analyse Réponse 'Manquante': "${missingMediaResponse || '(VIDE)'}"`)
    if (!missingMediaResponse) {
        console.log('   ✅ SUCCÈS: Réponse vide (Silence Strict respecté).')
    } else if (missingMediaResponse.includes('[IMAGE:')) {
        console.log('   ❌ ÉCHEC: Le tag IMAGE est passé alors que le média devrait manquer ! (Ou alors le média "kitchen" existe ?)')
    } else {
        console.log('   ℹ️ NOTE: L\'IA a répondu par texte (probablement un refus naturel).')
    }

    await prisma.$disconnect()
}

runTests().catch(console.error)
