import { PrismaClient } from '@prisma/client'
import { director } from '../lib/director'
import { settingsService } from '../lib/settings-cache'

const prisma = new PrismaClient()

async function main() {
    console.log('='.repeat(80))
    console.log('🧪 AGENT PROFILE VALIDATION TEST')
    console.log('='.repeat(80))
    console.log('')

    const agents = await prisma.agent.findMany({
        include: { profile: true }
    })

    console.log(`Found ${agents.length} agents to test\n`)

    const settings = await settingsService.getSettings()
    let passed = 0
    let failed = 0

    for (const agent of agents) {
        console.log(`\n${'─'.repeat(60)}`)
        console.log(`🤖 Testing: ${agent.name} (${agent.id})`)
        console.log(`${'─'.repeat(60)}`)

        // Test 1: Profile exists
        if (!agent.profile) {
            console.log('❌ FAILED: No profile found')
            failed++
            continue
        }
        console.log('✅ Profile exists')

        // Test 2: Required fields populated
        const p = agent.profile
        const requiredFields = [
            { name: 'contextTemplate', value: p.contextTemplate },
            { name: 'phaseConnectionTemplate', value: p.phaseConnectionTemplate },
            { name: 'phaseVulnerabilityTemplate', value: p.phaseVulnerabilityTemplate },
            { name: 'phaseCrisisTemplate', value: p.phaseCrisisTemplate },
            { name: 'phaseMoneypotTemplate', value: p.phaseMoneypotTemplate },
            { name: 'safetyRules', value: p.safetyRules },
            { name: 'styleRules', value: p.styleRules },
        ]

        let missingFields = requiredFields.filter(f => !f.value)
        if (missingFields.length > 0) {
            console.log(`⚠️  Missing ${missingFields.length} fields:`)
            missingFields.forEach(f => console.log(`   - ${f.name}`))
        } else {
            console.log('✅ All required template fields populated')
        }

        // Test 3: Build system prompt for each phase
        const phases = ['CONNECTION', 'VULNERABILITY', 'CRISIS', 'MONEYPOT'] as const
        const testContact = {
            id: 'test-contact',
            phone_whatsapp: '+1234567890',
            name: 'TestUser',
            createdAt: new Date()
        }

        console.log('\n📝 Testing buildSystemPrompt for each phase:')

        for (const phase of phases) {
            try {
                const prompt = await director.buildSystemPrompt(
                    settings,
                    testContact,
                    phase,
                    { trustScore: 50, daysActive: 5 },
                    'Base role for testing',
                    agent.id,
                    'Test progression'
                )

                if (prompt && prompt.length > 100) {
                    console.log(`   ✅ ${phase}: ${prompt.length} chars`)
                } else {
                    console.log(`   ⚠️  ${phase}: Prompt too short (${prompt?.length || 0} chars)`)
                }
            } catch (err: any) {
                console.log(`   ❌ ${phase}: ERROR - ${err.message}`)
                failed++
            }
        }

        // Test 4: Check locale and timezone
        console.log('\n📍 Configuration:')
        console.log(`   Locale: ${p.locale}`)
        console.log(`   Timezone: ${p.timezone}`)
        console.log(`   Base Age: ${p.baseAge}`)

        passed++
    }

    console.log('\n' + '='.repeat(80))
    console.log('📊 SUMMARY')
    console.log('='.repeat(80))
    console.log(`Agents tested: ${agents.length}`)
    console.log(`Passed: ${passed}`)
    console.log(`Failed: ${failed}`)

    if (failed === 0 && passed === agents.length) {
        console.log('\n✅ ALL AGENT PROFILE TESTS PASSED!')
    } else {
        console.log('\n⚠️  Some tests had issues - review above')
    }

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error('Fatal:', e)
    await prisma.$disconnect()
    process.exit(1)
})
