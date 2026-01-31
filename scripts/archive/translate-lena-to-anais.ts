import { PrismaClient } from '@prisma/client'
import axios from 'axios'

const prisma = new PrismaClient()

async function translateTemplate(englishText: string, fieldName: string): Promise<string> {
  console.log(`   🔄 Traduction de ${fieldName}...`)

  const prompt = `Tu es un traducteur professionnel. Traduis le texte suivant de l'anglais vers le français.

RÈGLES IMPORTANTES:
- Garde EXACTEMENT le même format (sauts de ligne, listes, etc.)
- Ne traduis PAS les balises techniques comme [VOICE], [IMAGE:...], [PAYMENT_RECEIVED], etc.
- Ne traduis PAS les noms propres (Lena, PayPal, etc.)
- Garde le même ton et la même structure
- Pour un chatbot adolescent, utilise un langage naturel français (pas trop formel)

TEXTE ANGLAIS À TRADUIRE:
${englishText}

TEXTE FRANÇAIS (traduction uniquement, sans commentaire):`

  try {
    const apiKey = process.env.VENICE_API_KEY
    if (!apiKey) {
      throw new Error('VENICE_API_KEY not configured')
    }

    const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
      model: 'venice-uncensored',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Traduis en français' }
      ],
      temperature: 0.3,
      max_tokens: 4000
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    const translation = response.data.choices[0]?.message?.content || ''
    return translation.trim()
  } catch (error: any) {
    console.error(`      ❌ Erreur de traduction: ${error.message}`)
    throw error
  }
}

async function translateLenaToAnais() {
  console.log('🔄 Traduction des templates de Lena vers Anaïs...\n')

  // Get Venice API key from settings
  const veniceKeySetting = await prisma.setting.findUnique({
    where: { key: 'venice_api_key' }
  })

  if (!veniceKeySetting || !veniceKeySetting.value) {
    console.log('❌ venice_api_key non trouvée dans la DB')
    await prisma.$disconnect()
    return
  }

  process.env.VENICE_API_KEY = veniceKeySetting.value
  console.log('✅ Venice API key chargée\n')

  // Get agents with profiles
  const lena = await prisma.agent.findFirst({
    where: { name: 'Lena' },
    include: { profile: true }
  })

  const anais = await prisma.agent.findFirst({
    where: { name: 'Anaïs' },
    include: { profile: true }
  })

  if (!lena || !anais || !lena.profile || !anais.profile) {
    console.log('❌ Agent ou profile introuvable')
    await prisma.$disconnect()
    return
  }

  console.log('✅ Agents trouvés')
  console.log(`Lena ID: ${lena.id}`)
  console.log(`Anaïs ID: ${anais.id}\n`)

  const templateFields = [
    'identityTemplate',
    'contextTemplate',
    'missionTemplate',
    'phaseConnectionTemplate',
    'phaseVulnerabilityTemplate',
    'phaseCrisisTemplate',
    'phaseMoneypotTemplate',
    'paymentRules',
    'safetyRules',
    'styleRules'
  ]

  console.log('📋 Traduction des templates...\n')

  const updateData: any = {}
  let translatedCount = 0

  for (const field of templateFields) {
    const englishValue = lena.profile[field] as string | null

    if (englishValue && englishValue.length > 0) {
      console.log(`🔄 ${field} (${englishValue.length} chars)`)

      try {
        const frenchValue = await translateTemplate(englishValue, field)
        updateData[field] = frenchValue
        translatedCount++

        console.log(`   ✅ Traduit (${frenchValue.length} chars)\n`)
      } catch (error) {
        console.log(`   ❌ Échec de traduction, champ ignoré\n`)
      }
    } else {
      console.log(`⏭️  ${field} vide, ignoré\n`)
    }
  }

  // Apply translations to Anaïs
  if (Object.keys(updateData).length > 0) {
    console.log('💾 Application des traductions à Anaïs...')

    await prisma.agentProfile.update({
      where: { agentId: anais.id },
      data: updateData
    })

    console.log(`\n✅ ${translatedCount} template(s) traduit(s) et appliqué(s) avec succès!`)
  } else {
    console.log('\n⚠️ Aucune traduction effectuée')
  }

  await prisma.$disconnect()
}

translateLenaToAnais().catch(console.error)
