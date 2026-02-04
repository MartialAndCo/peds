/**
 * Test avec VRAI appel Venice (comme dans chat.ts)
 * Vérifie que l'IA utilise le life context dans sa réponse
 */

import { director } from '../lib/director'
import { prisma } from '../lib/prisma'
import { venice } from '../lib/venice'

async function testWithVenice() {
    console.log('═'.repeat(80))
    console.log('🤖 TEST AVEC VENICE (vrai flux comme chat.ts)')
    console.log('═'.repeat(80))
    console.log()

    // Prendre Anaïs (Europe/Paris) pour tester 23h41
    const agent = await prisma.agent.findFirst({
        where: { name: { contains: 'anaïs', mode: 'insensitive' } }
    })

    if (!agent) {
        console.log('❌ Agent Anais non trouvée')
        return
    }

    console.log(`✅ Agent: ${agent.name} (${agent.id})`)

    const profile = await prisma.agentProfile.findUnique({
        where: { agentId: agent.id }
    })

    console.log(`📍 Timezone: ${profile?.timezone || 'Europe/Paris'}`)
    console.log(`🌍 Locale: ${profile?.locale}`)
    console.log()

    // Récupérer settings
    const settings = await prisma.setting.findMany()
    const settingsMap: Record<string, string> = {}
    settings.forEach(s => { settingsMap[s.key] = s.value })

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

    console.log('📝 Message utilisateur:', userMessage)
    console.log()

    // 1. Déterminer la phase
    const { phase, details } = await director.determinePhase(contact.phone_whatsapp, agent.id)
    console.log(`📊 Phase: ${phase}`)

    // 2. Construire le system prompt (AVEC life context injecté)
    const systemPrompt = await director.buildSystemPrompt(
        settingsMap,
        contact,
        phase,
        details,
        profile?.identityTemplate || 'Tu es Anais, 15 ans',
        agent.id,
        'Test life context'
    )

    // Afficher le CONTEXTE VIE ACTUEL injecté
    const contextMatch = systemPrompt.match(/\[CONTEXTE VIE ACTUEL[^\]]*\][^\n]*/)
    console.log()
    console.log('📍 CONTEXTE VIE ACTUEL injecté:')
    console.log('   ' + (contextMatch ? contextMatch[0] : 'NON TROUVÉ!'))
    console.log()

    // 3. Préparer messages pour Venice
    const messages = [
        { role: 'user' as const, content: userMessage }
    ]

    console.log('🤖 Appel à Venice...')
    console.log()

    try {
        // 4. Appeler Venice (comme dans chat.ts)
        const response = await venice.chatCompletion(
            systemPrompt,
            [], // pas d'historique pour ce test
            userMessage,
            {
                apiKey: settingsMap['venice_api_key'],
                model: 'venice-uncensored',
                temperature: 0.7,
                max_tokens: 500
            }
        )

        console.log('═'.repeat(80))
        console.log('📨 RÉPONSE DE L\'IA (Venice):')
        console.log('═'.repeat(80))
        console.log(response)
        console.log('═'.repeat(80))
        console.log()

        // 5. Analyser si elle utilise le contexte
        const responseLower = response.toLowerCase()
        const hasCours = responseLower.includes('cours') || responseLower.includes('école')
        const hasLit = responseLower.includes('lit') || responseLower.includes('dormir') || responseLower.includes('coucher')
        const hasOccupied = responseLower.includes('occupé') || responseLower.includes('peux pas') || responseLower.includes('là')

        console.log('🔍 ANALYSE de la réponse:')
        console.log(`   Mentionne "cours/école": ${hasCours ? '❌ OUI (INcohérent à 23h!)' : '✅ Non'}`)
        console.log(`   Mentionne "lit/dormir": ${hasLit ? '✅ OUI (cohérent!)' : '❌ Non'}`)
        console.log(`   Dit qu'elle est occupée: ${hasOccupied ? '✅ OUI' : '❌ Non'}`)
        console.log()

        // Vérifier la cohérence
        const contextHasDormir = contextMatch && contextMatch[0].includes('dormir')
        const contextHasCours = contextMatch && contextMatch[0].includes('cours')

        if (contextHasDormir && hasCours) {
            console.log('❌❌❌ PROBLÈME: L\'IA dit "en cours" alors que le contexte dit "dormir"!')
            console.log('   → Le fix ne fonctionne PAS')
        } else if (contextHasDormir && (hasLit || hasOccupied)) {
            console.log('✅✅✅ SUCCESS: L\'IA utilise le contexte correctement!')
            console.log('   → Elle dit qu\'elle est occupée/dort alors qu\'il est 23h')
        } else if (contextHasCours && hasCours) {
            console.log('✅✅✅ SUCCESS: L\'IA est cohérente avec le contexte (en cours)')
        } else {
            console.log('⚠️ Neutre: L\'IA n\'a pas explicitement mentionné son activité')
        }

    } catch (error) {
        console.error('❌ Erreur Venice:', error)
    } finally {
        await prisma.$disconnect()
    }
}

testWithVenice().catch(console.error)
