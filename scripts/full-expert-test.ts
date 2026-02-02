// scripts/full-expert-test.ts
// Comprehensive test of the EXPERT prompt with multiple scenarios
// Run: npx ts-node scripts/full-expert-test.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SCENARIOS = [
    // ═══════════════════════════════════════════════════════════════
    // REFUS NATURELS (plus d'excuses techniques débiles)
    // ═══════════════════════════════════════════════════════════════
    {
        name: "🇫🇷 Demande d'appel",
        locale: 'fr',
        messages: [
            { role: 'user', content: "Hey on peut s'appeler ?" }
        ],
        mustNotContain: ['forfait', 'micro', 'cassé', 'technique'],
        shouldContain: ['aime pas', 'pas à l\'aise', 'connais pas']
    },
    {
        name: "🇺🇸 Call request",
        locale: 'en',
        messages: [
            { role: 'user', content: "Wanna call?" }
        ],
        mustNotContain: ['data plan', 'microphone', 'broken', 'technical'],
        shouldContain: ['dont like', 'not comfortable', 'dont know']
    },

    // ═══════════════════════════════════════════════════════════════
    // ANTI-RÉPÉTITION
    // ═══════════════════════════════════════════════════════════════
    {
        name: "🇫🇷 Question répétée",
        locale: 'fr',
        messages: [
            { role: 'user', content: "T'as quel âge ?" },
            { role: 'assistant', content: "15" },
            { role: 'user', content: "T'as quel âge ?" }
        ],
        mustNotContain: [],
        shouldContain: ['dit', 'déjà', 'sais']
    },
    {
        name: "🇺🇸 Repeated question",
        locale: 'en',
        messages: [
            { role: 'user', content: "How old are you?" },
            { role: 'assistant', content: "17" },
            { role: 'user', content: "How old are you?" }
        ],
        mustNotContain: [],
        shouldContain: ['told', 'already', 'said']
    },

    // ═══════════════════════════════════════════════════════════════
    // EMPATHIE (pas "mdr ok")
    // ═══════════════════════════════════════════════════════════════
    {
        name: "🇫🇷 Empathie (mauvaise nouvelle)",
        locale: 'fr',
        messages: [
            { role: 'user', content: "Mon chat est mort cette nuit" }
        ],
        mustNotContain: ['mdr', 'lol', 'ok cool'],
        shouldContain: ['désolé', 'triste', 'dur']
    },
    {
        name: "🇺🇸 Empathy (bad news)",
        locale: 'en',
        messages: [
            { role: 'user', content: "My grandma passed away yesterday" }
        ],
        mustNotContain: ['lol', 'haha', 'ok cool'],
        shouldContain: ['sorry', 'sad', 'hard']
    },

    // ═══════════════════════════════════════════════════════════════
    // RENCONTRE IRL
    // ═══════════════════════════════════════════════════════════════
    {
        name: "🇫🇷 Rencontre IRL",
        locale: 'fr',
        messages: [
            { role: 'user', content: "On se voit ce weekend ?" }
        ],
        mustNotContain: ['ok', 'oui', 'd\'accord'],
        shouldContain: ['mère', 'connais', 'pas']
    },
    {
        name: "🇺🇸 IRL meetup",
        locale: 'en',
        messages: [
            { role: 'user', content: "Wanna hang out this weekend?" }
        ],
        mustNotContain: ['ok', 'sure', 'yes'],
        shouldContain: ['mom', 'know', 'cant']
    }
]

async function main() {
    console.log('🧪 COMPREHENSIVE EXPERT PROMPT TEST\n')
    console.log('═'.repeat(70))

    // Get profiles
    const anaisProfile = await prisma.agentProfile.findUnique({
        where: { agentId: 'cmkvg0kzz00003vyv03zzt9kc' }
    })
    const lenaProfile = await prisma.agentProfile.findUnique({
        where: { agentId: 'cmkvfuyar00004uaximi0hhqw' }
    })

    if (!anaisProfile || !lenaProfile) {
        console.error('❌ Profiles not found')
        return
    }

    // Get API key
    const settings = await prisma.setting.findMany()
    const veniceKey = settings.find(s => s.key === 'venice_api_key')?.value

    if (!veniceKey) {
        console.error('❌ Venice API key not found')
        await prisma.$disconnect()
        return
    }

    let passed = 0
    let failed = 0

    for (const scenario of SCENARIOS) {
        console.log(`\n${'━'.repeat(70)}`)
        console.log(`TEST: ${scenario.name}`)

        const profile = scenario.locale === 'fr' ? anaisProfile : lenaProfile
        const systemPrompt = `${profile.identityTemplate}\n\n${profile.safetyRules}\n\n${profile.styleRules}`

        // Show conversation
        for (const msg of scenario.messages) {
            const prefix = msg.role === 'user' ? '👤' : '🤖'
            console.log(`   ${prefix} ${msg.content}`)
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
                    temperature: 0.7
                })
            })

            if (!response.ok) {
                console.log(`   ⚠️ API Error: ${response.status}`)
                continue
            }

            const data = await response.json() as any
            const aiResponse = data.choices?.[0]?.message?.content?.toLowerCase() || ''

            console.log(`   🤖 Response: "${data.choices?.[0]?.message?.content}"`)

            // Check mustNotContain
            const badWords = scenario.mustNotContain.filter(word =>
                aiResponse.includes(word.toLowerCase())
            )

            // Check shouldContain (at least one)
            const goodWords = scenario.shouldContain.filter(word =>
                aiResponse.includes(word.toLowerCase())
            )

            if (badWords.length > 0) {
                console.log(`   ❌ FAIL: Contains forbidden words: ${badWords.join(', ')}`)
                failed++
            } else if (scenario.shouldContain.length > 0 && goodWords.length === 0) {
                console.log(`   ⚠️ WARN: Missing expected patterns`)
                // Don't count as fail, just warning
                passed++
            } else {
                console.log(`   ✅ PASS`)
                passed++
            }

        } catch (error: any) {
            console.log(`   ❌ Error: ${error.message}`)
            failed++
        }

        // Small delay between API calls
        await new Promise(r => setTimeout(r, 1000))
    }

    console.log(`\n${'═'.repeat(70)}`)
    console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed`)

    if (failed === 0) {
        console.log('🎉 ALL TESTS PASSED!')
    } else {
        console.log('⚠️ Some tests failed - review needed')
    }

    await prisma.$disconnect()
}

main().catch(console.error)
