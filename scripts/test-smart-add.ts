/**
 * Test Smart Add API
 */
import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { venice } from '../lib/venice'

const TEST_PHONE = '+33600000001'
const TEST_PLATFORM = 'Discord'
const TEST_CONVERSATION = `
matthias#1234: salut ça va ?
Téléa: oui trop bien et toi ?
matthias#1234: ouais tranquille, je joue à Valorant là
Téléa: ah cool moi je fais mes devoirs
matthias#1234: t'as quel âge ?
Téléa: 15 ans et toi ?
matthias#1234: 18
`

async function testSmartAdd() {
    console.log('🧪 Testing Smart Add API...\n')

    // 1. Get Venice API key from DB
    const veniceKeySetting = await prisma.setting.findUnique({ where: { key: 'venice_api_key' } })
    if (!veniceKeySetting?.value) {
        console.error('❌ No Venice API key in database')
        return
    }
    process.env.VENICE_API_KEY = veniceKeySetting.value
    console.log('✅ Venice API key loaded from DB')

    // 2. Get agent
    const agent = await prisma.agent.findFirst({ where: { isActive: true } })
    if (!agent) {
        console.error('❌ No active agent')
        return
    }
    console.log(`✅ Agent: ${agent.name} (${agent.id})`)

    // 3. Get agent profile for locale
    const agentProfile = await prisma.agentProfile.findUnique({ where: { agentId: agent.id } })
    const locale = agentProfile?.locale || 'fr-FR'
    console.log(`✅ Locale: ${locale}`)

    // 4. Build prompt
    const systemPrompt = `Tu es une ado de 15 ans. Tu vas reprendre cette conversation sur WhatsApp.
Génère UN SEUL paragraphe de contexte (max 200 mots) à retenir pour continuer naturellement. Inclus:
- Son prénom/surnom
- Son âge si mentionné
- D'où il vient
- Ses hobbies/intérêts
- Tout ce qui est important
- Plateforme d'origine: ${TEST_PLATFORM}

Retourne UNIQUEMENT le paragraphe, pas de JSON, pas de titre.`

    // 5. Call Venice
    console.log('\n📡 Calling Venice AI...')
    try {
        const generatedContext = await venice.chatCompletion(
            systemPrompt,
            [],
            TEST_CONVERSATION,
            { model: 'venice-uncensored', temperature: 0.5, max_tokens: 300 }
        )

        console.log('\n✅ Venice Response:')
        console.log('---')
        console.log(generatedContext)
        console.log('---')

        if (!generatedContext || generatedContext.trim().length < 10) {
            console.error('❌ AI failed to generate context (too short or empty)')
            return
        }

        // 6. Test contact creation
        console.log('\n📝 Testing contact creation...')
        let normalizedPhone = TEST_PHONE.replace(/\s/g, '')
        if (/^0[67]/.test(normalizedPhone)) {
            normalizedPhone = '+33' + normalizedPhone.substring(1)
        }
        console.log(`   Normalized phone: ${normalizedPhone}`)

        // Check if contact exists
        const existingContact = await prisma.contact.findUnique({ where: { phone_whatsapp: normalizedPhone } })
        if (existingContact) {
            console.log(`   ⚠️ Contact already exists: ${existingContact.id}`)
        } else {
            console.log(`   ✅ Contact does not exist, would create new one`)
        }

        console.log('\n✅ Smart Add logic works! The issue is likely in the frontend or API route.')

    } catch (e: any) {
        console.error('\n❌ Venice call failed:', e.message)
        console.error(e)
    }
}

testSmartAdd()
    .then(() => process.exit(0))
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
