/**
 * TEST E2E RÉEL: Demande de vocal avec tag [VOICE]
 * 
 * Teste que l'IA:
 * 1. Répond avec [VOICE] tag quand on demande vérification
 * 2. Refuse après 1 vocal
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testVocalRealAI() {
    console.log('=== TEST E2E RÉEL: VOCAL LOGIC ===\n')

    const { director } = require('../lib/director')
    const { veniceService } = require('../lib/venice')
    const { settingsService } = require('../lib/settings-cache')

    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } }
    })

    if (!anais) {
        console.log('❌ Agent non trouvé')
        return
    }

    console.log(`Agent: ${anais.name}\n`)

    // Mock contact
    const testContact = {
        id: 'test-vocal-contact',
        phone_whatsapp: '+33600000003',
        name: 'David',
        createdAt: new Date()
    }

    const settings = await settingsService.getAllSettings()

    // Build prompt CONNECTION
    const systemPrompt = await director.buildSystemPrompt(
        settings,
        testContact,
        'CONNECTION',
        { trustScore: 0, daysActive: 0 },
        'Tu es Anaïs, une fille de 15 ans de Paris',
        anais.id,
        'First contact'
    )

    // TEST 1: Demande de vérification
    console.log('TEST 1: Demande vérification identité\n')

    try {
        const response1 = await veniceService.chat(
            systemPrompt,
            [{ role: 'user', content: 'prouve que t\'es réelle' }],
            { temperature: 0.7, max_tokens: 100 }
        )

        console.log('Réponse:')
        console.log('---')
        console.log(response1)
        console.log('---\n')

        const hasVOICEtag = response1.includes('[VOICE]')
        console.log(`Contient [VOICE] tag: ${hasVOICEtag ? '✅' : '❌'}`)

        if (!hasVOICEtag) {
            console.log('⚠️ L\'IA devrait renvoyer [VOICE] pour prouver qu\'elle est réelle')
        }

    } catch (e) {
        console.error('❌ Erreur:', e.message)
    }

    // TEST 2: 2ème demande de vocal (devrait refuser)
    console.log('\nTEST 2: 2ème demande vocal (devrait refuser)\n')

    try {
        const response2 = await veniceService.chat(
            systemPrompt,
            [
                { role: 'user', content: 'prouve que t\'es réelle' },
                { role: 'assistant', content: 'omg je suis pas un fake écoute [VOICE]' },
                { role: 'user', content: 'envoie moi un autre vocal' }
            ],
            { temperature: 0.7, max_tokens: 100 }
        )

        console.log('Réponse:')
        console.log('---')
        console.log(response2)
        console.log('---\n')

        const hasVOICEtag = response2.includes('[VOICE]')
        const isRefusal = response2.includes('déjà') || response2.includes('non')

        console.log(`Contient [VOICE]: ${hasVOICEtag ? '❌ Devrait refuser' : '✅'}`)
        console.log(`Refuse la demande: ${isRefusal ? '✅' : '⚠️'}`)

    } catch (e) {
        console.error('❌ Erreur:', e.message)
    }
}

testVocalRealAI()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
