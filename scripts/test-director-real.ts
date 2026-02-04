/**
 * Test réel du director avec la vraie base de données
 * Vérifie que le life context est injecté dans un vrai flux de conversation
 */

import { director } from '../lib/director'
import { prisma } from '../lib/prisma'

async function testDirectorReal() {
    console.log('═'.repeat(80))
    console.log('🧪 TEST RÉEL DU DIRECTOR AVEC DB')
    console.log('═'.repeat(80))
    console.log()

    try {
        // Récupérer un vrai agent (lena par exemple)
        const agent = await prisma.agent.findFirst({
            where: { name: { contains: 'lena', mode: 'insensitive' } }
        })

        if (!agent) {
            console.log('❌ Agent "lena" non trouvé dans la DB')
            console.log('Agents disponibles:')
            const agents = await prisma.agent.findMany({ select: { id: true, name: true } })
            agents.forEach(a => console.log(`  - ${a.id}: ${a.name}`))
            return false
        }

        console.log(`✅ Agent trouvé: ${agent.name} (${agent.id})`)

        // Récupérer ou créer un contact de test
        let contact = await prisma.contact.findFirst({
            where: { phone_whatsapp: '+33699999999' }
        })

        if (!contact) {
            console.log('📝 Création d\'un contact de test...')
            contact = await prisma.contact.create({
                data: {
                    phone_whatsapp: '+33699999999',
                    name: 'TestUser',
                    source: 'test',
                    notes: 'Contact créé pour test life context'
                }
            })
        }

        console.log(`✅ Contact: ${contact.name} (${contact.phone_whatsapp})`)
        console.log()

        // Vérifier que l'agent a un profile avec timezone
        const profile = await prisma.agentProfile.findUnique({
            where: { agentId: agent.id }
        })

        if (!profile) {
            console.log('❌ AgentProfile manquant pour cet agent')
            return false
        }

        console.log(`📍 Timezone de l'agent: ${profile.timezone || 'Europe/Paris (default)'}`)
        console.log(`🌍 Locale: ${profile.locale}`)
        console.log()

        // Appeler le director comme dans le vrai flux
        console.log('🎬 Appel de director.buildSystemPrompt()...')
        console.log()

        const mockSettings = {}
        const phase = 'CONNECTION' as const
        const details = { signals: [], signalCount: 0, trustScore: 0 }
        const baseRole = profile.identityTemplate?.substring(0, 100) || 'Tu es une ado de 15 ans'

        const systemPrompt = await director.buildSystemPrompt(
            mockSettings,
            contact,
            phase,
            details,
            baseRole,
            agent.id,
            'Test life context injection'
        )

        console.log('✅ Prompt généré avec succès!')
        console.log()

        // Chercher le CONTEXTE VIE ACTUEL dans le prompt
        const lifeContextMatch = systemPrompt.match(/\[CONTEXTE VIE ACTUEL[^\]]*\][^\n]*/)

        if (lifeContextMatch) {
            console.log('🎯 CONTEXTE VIE ACTUEL trouvé dans le prompt:')
            console.log('   ' + lifeContextMatch[0])
            console.log()
            console.log('✅✅✅ SUCCESS: Le life context est bien injecté!')
        } else {
            console.log('❌ CONTEXTE VIE ACTUEL NON TROUVÉ dans le prompt!')
            console.log()
            console.log('--- Début du prompt ---')
            console.log(systemPrompt.substring(0, 1500))
            console.log('--- Fin extrait ---')
            return false
        }

        // Afficher les premières lignes du prompt pour vérifier la structure
        console.log()
        console.log('📋 Structure du prompt (premières lignes):')
        console.log('-'.repeat(80))
        const lines = systemPrompt.split('\n').slice(0, 20)
        lines.forEach((line, i) => {
            if (line.includes('CONTEXTE VIE')) {
                console.log(`>> ${line}`) // Met en évidence
            } else {
                console.log(line)
            }
        })
        console.log('-'.repeat(80))
        console.log('...')
        console.log()

        return true

    } catch (error) {
        console.error('❌ Erreur:', error)
        return false
    } finally {
        await prisma.$disconnect()
    }
}

testDirectorReal()
    .then(success => process.exit(success ? 0 : 1))
    .catch(() => process.exit(1))
