/**
 * Test simple: Appelle juste le director et montre ce qu'il génère
 * Pas de modification, pas d'invention - juste le vrai flux
 */

import { director } from '../lib/director'
import { prisma } from '../lib/prisma'

async function testDirectorSimple() {
    console.log('═'.repeat(80))
    console.log('🧪 TEST DIRECTOR - FLUX RÉEL')
    console.log('═'.repeat(80))
    console.log()

    // Récupérer un agent (Anaïs)
    const agent = await prisma.agent.findFirst({
        where: { name: { contains: 'anaïs', mode: 'insensitive' } }
    })

    if (!agent) {
        console.log('❌ Agent non trouvé')
        return
    }

    console.log(`Agent: ${agent.name}`)

    // Contact test
    let contact = await prisma.contact.findFirst({
        where: { phone_whatsapp: '+33699999999' }
    })
    if (!contact) {
        contact = await prisma.contact.create({
            data: {
                phone_whatsapp: '+33699999999',
                name: 'TestUser',
                source: 'test'
            }
        })
    }

    // Appeler le director comme dans le vrai chat.ts
    const { phase, details } = await director.determinePhase(contact.phone_whatsapp, agent.id)

    const settings = await prisma.setting.findMany()
    const settingsMap: Record<string, string> = {}
    settings.forEach(s => { settingsMap[s.key] = s.value })

    // Récupérer le vrai prompt système de la conversation
    const conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id },
        include: { prompt: true }
    })

    const baseRole = conversation?.prompt?.system_prompt || 'Tu es une ado de 15 ans'

    console.log()
    console.log('Appel de director.buildSystemPrompt()...')
    console.log()

    const systemPrompt = await director.buildSystemPrompt(
        settingsMap,
        contact,
        phase,
        details,
        baseRole,
        agent.id,
        'Test'
    )

    console.log('═'.repeat(80))
    console.log('PROMPT GÉNÉRÉ PAR LE DIRECTOR:')
    console.log('═'.repeat(80))
    console.log(systemPrompt)
    console.log('═'.repeat(80))

    // ========================================================================
    // TEST LLM RESPONSE
    // ========================================================================
    const userMessage = "Tu fais quoi ?"
    console.log(`\n🤖 TEST INTERACTION:\nUser: "${userMessage}"`)
    console.log('En attente de la réponse LLM...\n')

    // Import dynamique pour éviter les erreurs de cycle si jamais
    const { venice } = require('../lib/venice')

    const apiKey = settingsMap['venice_api_key']
    console.log(`Clé Venice trouvée en DB : ${apiKey ? 'OUI' : 'NON'}`)

    try {
        const response = await venice.chatCompletion(
            systemPrompt,
            [], // Pas d'historique pour ce test
            userMessage,
            {
                apiKey: apiKey,
                temperature: 0.7,
                max_tokens: 150
            }
        )

        console.log('═'.repeat(80))
        console.log('RÉPONSE IA:')
        console.log('═'.repeat(80))
        console.log(response)
        console.log('═'.repeat(80))

        // Analyze context match (Find the one with a timestamp/colon, not the instruction mention)
        const contextMatch = systemPrompt.match(/\[CONTEXTE VIE ACTUEL -[^\]]+\]:[^\n]*/)
        console.log('\n🔍 VÉRIFICATION:')
        console.log('Contexte injecté :', contextMatch ? contextMatch[0] : 'NON TROUVÉ (Ou format incorrect)')

        // Simple heuristic check
        const lowerResponse = response.toLowerCase()
        const lowerContext = contextMatch ? contextMatch[0].toLowerCase() : ''

        // Check keywords from context in response
        // This is a loose check but helpful for visual verification
        console.log('La réponse semble-t-elle cohérente ? (Vérification manuelle requise)')
    } catch (error) {
        console.error('Erreur lors de l\'appel LLM:', error)
    }

    await prisma.$disconnect()
}

testDirectorSimple().catch(console.error)
