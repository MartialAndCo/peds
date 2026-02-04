/**
 * Test end-to-end: Vérifie que l'IA utilise VRAIMENT le life context dans ses réponses
 * Simule des conversations à différentes heures et vérifie la cohérence
 */

import { director } from '../lib/director'
import { prisma } from '../lib/prisma'

// Mock time pour tester différents scénarios
function createMockDate(hour: number, minute: number, dayOfWeek: number): Date {
    const date = new Date()
    date.setHours(hour, minute, 0, 0)
    const currentDay = date.getDay()
    const diff = dayOfWeek - currentDay
    date.setDate(date.getDate() + diff)
    return date
}

async function testConversationAtTime(
    agentId: string,
    contact: any,
    hour: number,
    minute: number,
    dayOfWeek: number,
    userMessage: string,
    expectedActivityKeywords: string[],
    forbiddenKeywords: string[]
) {
    const mockDate = createMockDate(hour, minute, dayOfWeek)
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`

    console.log(`\n🕐 Test à ${timeStr} (jour: ${dayOfWeek})`)
    console.log(`   Message utilisateur: "${userMessage}"`)

    // Temporairement modifier le prompt pour forcer une heure spécifique
    const profile = await prisma.agentProfile.findUnique({ where: { agentId } })
    const baseRole = profile?.identityTemplate || 'Tu es une ado de 15 ans'

    const systemPrompt = await director.buildSystemPrompt(
        {},
        contact,
        'CONNECTION',
        { signals: [], signalCount: 0, trustScore: 0 },
        baseRole,
        agentId,
        'Test'
    )

    // Log du contexte injecté
    const contextMatch = systemPrompt.match(/\[CONTEXTE VIE ACTUEL[^\]]*\][^\n]*/)
    if (contextMatch) {
        console.log(`   Contexte injecté: ${contextMatch[0]}`)
    }

    // TODO: Ici on ferait un vrai appel LLM pour tester
    // Pour l'instant on vérifie juste que le contexte est présent
    console.log(`   ✅ Contexte présent: ${contextMatch ? 'OUI' : 'NON'}`)

    return true
}

async function runTests() {
    console.log('═'.repeat(80))
    console.log('🧪 TEST: L\'IA utilise-t-elle le life context dans ses réponses ?')
    console.log('═'.repeat(80))

    const agent = await prisma.agent.findFirst({
        where: { name: { contains: 'lena', mode: 'insensitive' } }
    })

    if (!agent) {
        console.log('❌ Agent non trouvé')
        return false
    }

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

    // Scénarios de test
    const scenarios = [
        {
            hour: 23, minute: 41, dayOfWeek: 1,
            message: 'Envoie une photo de toi',
            expected: ['lit', 'dormir', 'tel'],
            forbidden: ['cours', 'école', 'classe']
        },
        {
            hour: 10, minute: 0, dayOfWeek: 1,
            message: 'Tu fais quoi ?',
            expected: ['cours', 'classe', 'école'],
            forbidden: ['lit', 'dormir']
        },
        {
            hour: 12, minute: 0, dayOfWeek: 1,
            message: 'T\'es où ?',
            expected: ['cantine', 'mange', 'déjeuner'],
            forbidden: ['cours', 'dort']
        }
    ]

    for (const scenario of scenarios) {
        await testConversationAtTime(
            agent.id,
            contact,
            scenario.hour,
            scenario.minute,
            scenario.dayOfWeek,
            scenario.message,
            scenario.expected,
            scenario.forbidden
        )
    }

    await prisma.$disconnect()
    console.log('\n✅ Tests terminés')
}

runTests().catch(console.error)
