/**
 * Test avec VRAI appel LLM
 * Vérifie que l'IA utilise le life context dans sa réponse
 */

import { director } from '../lib/director'
import { prisma } from '../lib/prisma'
import { anthropic } from '../lib/anthropic'

async function testRealLLMResponse() {
    console.log('═'.repeat(80))
    console.log('🤖 TEST AVEC VRAI APPEL LLM')
    console.log('═'.repeat(80))
    console.log()

    // Prendre Anais (Europe/Paris) pour tester 23h41
    const agent = await prisma.agent.findFirst({
        where: { name: { contains: 'anais', mode: 'insensitive' } }
    })

    if (!agent) {
        console.log('❌ Agent Anais non trouvée')
        console.log('Agents dispos:')
        const agents = await prisma.agent.findMany({ select: { id: true, name: true } })
        agents.forEach(a => console.log(`  - ${a.name}`))
        return
    }

    console.log(`✅ Agent: ${agent.name} (${agent.id})`)

    // Vérifier son timezone
    const profile = await prisma.agentProfile.findUnique({
        where: { agentId: agent.id }
    })
    console.log(`📍 Timezone: ${profile?.timezone || 'Europe/Paris (default)'}`)
    console.log(`🌍 Locale: ${profile?.locale}`)
    console.log()

    // Créer contact test
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

    // Message du problème original
    const userMessage = 'Envoie une photo de toi stp'

    console.log('📝 Génération du system prompt...')
    const systemPrompt = await director.buildSystemPrompt(
        {},
        contact,
        'CONNECTION',
        { signals: [], signalCount: 0, trustScore: 0 },
        profile?.identityTemplate || 'Tu es Anais, 15 ans',
        agent.id,
        'Test life context'
    )

    // Afficher le CONTEXTE VIE ACTUEL
    const contextMatch = systemPrompt.match(/\[CONTEXTE VIE ACTUEL[^\]]*\][^\n]*/)
    if (contextMatch) {
        console.log('📍 Contexte injecté:')
        console.log('   ' + contextMatch[0])
        console.log()
    }

    // Messages de conversation
    const messages = [
        { role: 'user' as const, content: userMessage }
    ]

    console.log('🤖 Appel au LLM (Claude)...')
    console.log(`   Message: "${userMessage}"`)
    console.log()

    try {
        const response = await sendMessage(messages, systemPrompt)

        console.log('═'.repeat(80))
        console.log('📨 RÉPONSE DE L\'IA:')
        console.log('═'.repeat(80))
        console.log(response)
        console.log('═'.repeat(80))
        console.log()

        // Analyser la réponse
        const responseLower = response.toLowerCase()
        const hasCours = responseLower.includes('cours') || responseLower.includes('école')
        const hasLit = responseLower.includes('lit') || responseLower.includes('dormir') || responseLower.includes('coucher')
        const hasOccupied = responseLower.includes('occupé') || responseLower.includes('peux pas')

        console.log('🔍 ANALYSE:')
        console.log(`   Mentionne "cours/école": ${hasCours ? '❌ OUI (PROBLÈME!)' : '✅ Non'}`)
        console.log(`   Mentionne "lit/dormir": ${hasLit ? '✅ OUI (cohérent 23h)' : '❌ Non'}`)
        console.log(`   Dit qu'elle est occupée: ${hasOccupied ? '✅ OUI' : '❌ Non'}`)

        if (contextMatch && contextMatch[0].includes('dormir') && hasCours) {
            console.log()
            console.log('❌❌❌ ERREUR: L\'IA dit "en cours" alors qu\'elle devrait dormir!')
        } else if (contextMatch && contextMatch[0].includes('dormir') && (hasLit || hasOccupied)) {
            console.log()
            console.log('✅✅✅ SUCCESS: L\'IA utilise le contexte correctement!')
        }

    } catch (error) {
        console.error('❌ Erreur LLM:', error)
    } finally {
        await prisma.$disconnect()
    }
}

testRealLLMResponse().catch(console.error)
