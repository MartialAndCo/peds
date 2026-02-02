// scripts/test-lena-expert.ts
// Quick test for Lena EXPERT prompt
// Run: npx ts-node scripts/test-lena-expert.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TEST_SCENARIOS = [
    {
        name: "Call request",
        messages: [
            { role: 'user', content: "Hey wanna call?" }
        ],
        expectation: "Natural refusal (dont like calls, not comfortable) - NOT 'no data plan'"
    },
    {
        name: "Empathy test",
        messages: [
            { role: 'user', content: "my dog died yesterday" }
        ],
        expectation: "Empathetic response, NOT 'lol ok'"
    }
]

async function main() {
    console.log('🧪 Testing Lena EXPERT prompt...\n')

    const LENA_AGENT_ID = 'cmkvfuyar00004uaximi0hhqw'

    const profile = await prisma.agentProfile.findUnique({
        where: { agentId: LENA_AGENT_ID }
    })

    if (!profile) {
        console.error('❌ Profile not found')
        return
    }

    const settings = await prisma.setting.findMany()
    const veniceKey = settings.find(s => s.key === 'venice_api_key')?.value

    if (!veniceKey) {
        console.error('❌ Venice API key not found')
        await prisma.$disconnect()
        return
    }

    const systemPrompt = `${profile.identityTemplate}\n\n${profile.safetyRules}\n\n${profile.styleRules}`

    for (const scenario of TEST_SCENARIOS) {
        console.log('━'.repeat(60))
        console.log(`🧪 TEST: ${scenario.name}`)
        console.log(`📝 Expected: ${scenario.expectation}`)
        console.log('')

        for (const msg of scenario.messages) {
            console.log(`   👤 User: "${msg.content}"`)
        }

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
                    max_tokens: 100,
                    temperature: 0.8
                })
            })

            if (!response.ok) {
                console.log(`   ❌ API Error: ${response.status}`)
                continue
            }

            const data = await response.json() as any
            const aiResponse = data.choices?.[0]?.message?.content || '(no response)'
            console.log(`   🤖 AI: "${aiResponse}"`)

        } catch (error: any) {
            console.log(`   ❌ Error: ${error.message}`)
        }
        console.log('')
    }

    console.log('━'.repeat(60))
    console.log('🏁 Done!')

    await prisma.$disconnect()
}

main().catch(console.error)
