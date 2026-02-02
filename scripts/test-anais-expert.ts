// scripts/test-anais-expert.ts
// Tests the new EXPERT approach with sample conversations
// Run: npx ts-node scripts/test-anais-expert.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Test scenarios - things that made the AI sound stupid before
const TEST_SCENARIOS = [
    {
        name: "Demande d'appel",
        messages: [
            { role: 'user', content: "Salut ça va ?" },
            { role: 'assistant', content: "hey oui et toi ?" },
            { role: 'user', content: "On peut s'faire un appel ? J'ai envie d'entendre ta voix" }
        ],
        expectation: "Doit refuser naturellement (j'aime pas les appels, pas à l'aise) - PAS 'pas de forfait'"
    },
    {
        name: "Question répétée",
        messages: [
            { role: 'user', content: "Tu fais quoi comme sport ?" },
            { role: 'assistant', content: "basket 🏀" },
            { role: 'user', content: "Ah cool ! Et sinon tu fais quoi comme sport ?" }
        ],
        expectation: "Doit varier sa réponse (je t'ai dit, tu sais déjà) - PAS répéter 'basket'"
    },
    {
        name: "Rencontre IRL",
        messages: [
            { role: 'user', content: "T'habites où ?" },
            { role: 'assistant', content: "région parisienne" },
            { role: 'user', content: "Nice ! On pourrait se voir un de ces jours non ?" }
        ],
        expectation: "Doit refuser naturellement (ma mère, je te connais pas) - PAS donner d'adresse"
    },
    {
        name: "Test variété (pas mdr partout)",
        messages: [
            { role: 'user', content: "T'es trop belle sur ta photo" },
        ],
        expectation: "Doit répondre sans commencer par 'mdr' obligatoirement"
    },
    {
        name: "Réponse contextuelle",
        messages: [
            { role: 'user', content: "Ma grand-mère est morte hier" },
        ],
        expectation: "Doit répondre avec empathie, PAS 'mdr ok' ou une phrase générique"
    }
]

async function main() {
    console.log('🧪 Testing Anaïs EXPERT prompt...\n')

    // Get Anaïs profile with new templates
    const ANAIS_AGENT_ID = 'cmkvg0kzz00003vyv03zzt9kc'

    const profile = await prisma.agentProfile.findUnique({
        where: { agentId: ANAIS_AGENT_ID }
    })

    if (!profile) {
        console.error('❌ Profile not found')
        return
    }

    // Get settings for API key
    const settings = await prisma.setting.findMany()
    const veniceKey = settings.find(s => s.key === 'venice_api_key')?.value

    if (!veniceKey) {
        console.error('❌ Venice API key not found in settings')
        console.log('   Add it with: INSERT INTO settings (key, value) VALUES (\'venice_api_key\', \'your-key\')')
        await prisma.$disconnect()
        return
    }

    console.log('📋 Using EXPERT templates:')
    console.log(`   - identityTemplate: ${profile.identityTemplate?.length} chars`)
    console.log(`   - safetyRules: ${profile.safetyRules?.length} chars`)
    console.log(`   - styleRules: ${profile.styleRules?.length} chars`)
    console.log('')

    // Build system prompt
    const systemPrompt = `${profile.identityTemplate}

${profile.safetyRules}

${profile.styleRules}`

    // Run each test
    for (const scenario of TEST_SCENARIOS) {
        console.log('━'.repeat(70))
        console.log(`🧪 TEST: ${scenario.name}`)
        console.log(`📝 Attente: ${scenario.expectation}`)
        console.log('')

        // Show conversation history
        console.log('💬 Conversation:')
        for (const msg of scenario.messages) {
            const prefix = msg.role === 'user' ? '   👤 User:' : '   🤖 AI:'
            console.log(`${prefix} "${msg.content}"`)
        }
        console.log('')

        // Call Venice API
        try {
            const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${veniceKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...scenario.messages
                    ],
                    max_tokens: 150,
                    temperature: 0.8
                })
            })

            if (!response.ok) {
                const errorText = await response.text()
                console.log(`   ❌ API Error: ${response.status} - ${errorText}`)
                continue
            }

            const data = await response.json() as any
            const aiResponse = data.choices?.[0]?.message?.content || '(no response)'

            console.log(`   🤖 AI Response: "${aiResponse}"`)

            // Quick analysis
            const issues: string[] = []

            if (aiResponse.toLowerCase().includes('forfait')) {
                issues.push('❌ Mentionne "forfait" (excuse débile)')
            }
            if (aiResponse.toLowerCase().startsWith('mdr') && scenario.name !== "Test variété") {
                issues.push('⚠️ Commence par "mdr"')
            }
            if (scenario.name === "Question répétée" && aiResponse.toLowerCase().includes('basket') && !aiResponse.toLowerCase().includes('dit')) {
                issues.push('❌ Répète "basket" sans variété')
            }
            if (scenario.name.includes("appel") && (aiResponse.toLowerCase().includes('ok') || aiResponse.toLowerCase().includes('oui'))) {
                issues.push('❌ Accepte l\'appel au lieu de refuser')
            }

            if (issues.length > 0) {
                console.log(`   ${issues.join('\n   ')}`)
            } else {
                console.log('   ✅ Semble correct!')
            }

        } catch (error: any) {
            console.log(`   ❌ Error: ${error.message}`)
        }

        console.log('')
    }

    console.log('━'.repeat(70))
    console.log('🏁 Tests terminés!')

    await prisma.$disconnect()
}

main().catch(console.error)
