/**
 * TEST E2E RÉEL: Phase CONNECTION avec Director + Venice LLM
 * 
 * Ce test appelle vraiment:
 * 1. Director.buildSystemPrompt() avec profil Anaïs
 * 2. Venice API avec le prompt construit
 * 3. Vérifie la réponse de l'IA
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testConnectionPhaseRealAI() {
    console.log('=== TEST E2E RÉEL: PHASE CONNECTION ===\n')

    // Import Director
    const { director } = require('../lib/director')
    const { veniceService } = require('../lib/venice')
    const { settingsService } = require('../lib/settings-cache')

    // 1. Trouver Anaïs
    const anais = await prisma.agent.findFirst({
        where: { name: { contains: 'Ana', mode: 'insensitive' } },
        include: { profile: true }
    })

    if (!anais) {
        console.log('❌ Agent Anaïs non trouvé')
        return
    }

    console.log(`Agent: ${anais.name}`)
    console.log(`ID: ${anais.id}`)
    console.log(`Âge: ${anais.profile?.baseAge}\n`)

    // 2. Mock contact
    const testContact = {
        id: 'test-contact-id',
        phone_whatsapp: '+33600000001',
        name: 'Marc',
        createdAt: new Date()
    }

    // 3. Get settings
    const settings = await settingsService.getAllSettings()

    // 4. Déterminer phase
    console.log('🔍 Calcul de la phase...')
    const { phase, details, reason } = await director.determinePhase(
        testContact.phone_whatsapp,
        anais.id
    )

    console.log(`Phase déterminée: ${phase}`)
    console.log(`Raison: ${reason}`)
    console.log(`Trust: ${details.trustScore}\n`)

    // 5. Build system prompt
    console.log('📝 Construction du prompt système...')
    const systemPrompt = await director.buildSystemPrompt(
        settings,
        testContact,
        'CONNECTION', // Force CONNECTION pour ce test
        { trustScore: 0, daysActive: 0 },
        'Tu es Anaïs, une fille de 15 ans de Paris',
        anais.id,
        'First contact'
    )

    console.log(`✅ Prompt construit (${systemPrompt.length} chars)`)

    // Check payment variable
    if (systemPrompt.includes('{{PAYMENT_METHODS}}')) {
        console.log('❌ ERREUR: {{PAYMENT_METHODS}} pas remplacé!')
    } else {
        console.log('✅ {{PAYMENT_METHODS}} remplacé')
    }

    // 6. Test message utilisateur
    const userMessage = "salut ça va?"

    console.log(`\n💬 Message utilisateur: "${userMessage}"`)
    console.log('\n🤖 Appel Venice API...\n')

    // 7. Call Venice
    try {
        const response = await veniceService.chat(
            systemPrompt,
            [{ role: 'user', content: userMessage }],
            {
                temperature: 0.7,
                max_tokens: 150
            }
        )

        console.log('✅ Réponse reçue de Venice:\n')
        console.log('---')
        console.log(response)
        console.log('---\n')

        // 8. Vérifications
        console.log('📊 Vérifications:')

        const isShort = response.length < 100
        console.log(`  Réponse courte (< 100 chars): ${isShort ? '✅' : '❌'} (${response.length} chars)`)

        const isLowercase = response === response.toLowerCase()
        console.log(`  Minuscules: ${isLowercase ? '✅' : '⚠️'}`)

        const hasFrenchSlang = response.includes('jsp') || response.includes('mdr') || response.includes('wsh')
        console.log(`  Argot français: ${hasFrenchSlang ? '✅' : '⚠️'}`)

        const isRobotic = response.includes('How can I help') || response.includes('What can I do')
        console.log(`  Pas robotique: ${!isRobotic ? '✅' : '❌'}`)

        console.log('\n✅ Test CONNECTION phase terminé')

    } catch (e) {
        console.error('\n❌ Erreur Venice:', e.message)
    }
}

testConnectionPhaseRealAI()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
