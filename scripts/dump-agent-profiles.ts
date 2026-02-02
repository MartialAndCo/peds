// scripts/dump-agent-profiles.ts
// Usage: npx ts-node scripts/dump-agent-profiles.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('📊 Fetching Agent Profiles from Database...\n')

    const agents = await prisma.agent.findMany({
        include: {
            profile: true
        }
    })

    for (const agent of agents) {
        console.log('━'.repeat(80))
        console.log(`🤖 AGENT: ${agent.name} (ID: ${agent.id})`)
        console.log(`   Phone: ${agent.phone}`)
        console.log(`   Active: ${agent.isActive}`)
        console.log('━'.repeat(80))

        if (!agent.profile) {
            console.log('   ⚠️  NO PROFILE FOUND\n')
            continue
        }

        const p = agent.profile

        console.log(`\n📋 PROFILE METADATA:`)
        console.log(`   - Base Age: ${p.baseAge}`)
        console.log(`   - Locale: ${p.locale}`)
        console.log(`   - Timezone: ${p.timezone}`)
        console.log(`   - Fast Track Days: ${p.fastTrackDays}`)
        console.log(`   - Updated: ${p.updatedAt}`)

        console.log(`\n💳 PAYMENT CONFIG:`)
        console.log(`   - PayPal: ${p.paypalEmail || 'N/A'}`)
        console.log(`   - CashApp: ${p.cashappTag || 'N/A'}`)
        console.log(`   - Venmo: ${p.venmoHandle || 'N/A'}`)
        console.log(`   - Bank Account: ${p.bankAccountNumber ? '****' + p.bankAccountNumber.slice(-4) : 'N/A'}`)

        console.log(`\n📝 TEMPLATES:`)

        const templates = [
            { name: 'identityTemplate', value: p.identityTemplate },
            { name: 'contextTemplate', value: p.contextTemplate },
            { name: 'missionTemplate', value: p.missionTemplate },
            { name: 'styleRules', value: p.styleRules },
            { name: 'safetyRules', value: p.safetyRules },
            { name: 'paymentRules', value: p.paymentRules },
            { name: 'phaseConnectionTemplate', value: p.phaseConnectionTemplate },
            { name: 'phaseVulnerabilityTemplate', value: p.phaseVulnerabilityTemplate },
            { name: 'phaseCrisisTemplate', value: p.phaseCrisisTemplate },
            { name: 'phaseMoneypotTemplate', value: p.phaseMoneypotTemplate },
        ]

        for (const t of templates) {
            const charCount = t.value?.length || 0
            const lineCount = t.value?.split('\n').length || 0
            console.log(`   - ${t.name}: ${charCount} chars, ${lineCount} lines`)

            // Check for problematic patterns
            if (t.value) {
                const issues: string[] = []

                // Check for "mdr ok" repetition patterns
                if (t.value.toLowerCase().includes('mdr ok')) {
                    issues.push('Contains "mdr ok" pattern')
                }
                if (t.value.toLowerCase().includes('faut faire gaffe')) {
                    issues.push('Contains "faut faire gaffe" pattern')
                }
                if (t.value.toLowerCase().includes('maman me suit')) {
                    issues.push('Contains "maman me suit" pattern')
                }

                // Check for Venice pollution
                if (t.value.includes('Venice Uncensored') || t.value.includes('Venice.ai')) {
                    issues.push('🔴 Contains Venice system injection')
                }

                // Check for missing variety rules
                if (t.name === 'styleRules' && !t.value.includes('VARIÉTÉ')) {
                    issues.push('⚠️ Missing VARIÉTÉ/variety rule')
                }

                // Check for call/meeting rules
                if (t.name === 'safetyRules') {
                    if (!t.value.toLowerCase().includes('appel') && !t.value.toLowerCase().includes('call')) {
                        issues.push('⚠️ No phone call rule')
                    }
                }

                if (issues.length > 0) {
                    console.log(`      🚨 ISSUES: ${issues.join(', ')}`)
                }
            }
        }

        // Print full raw content of key templates
        console.log('\n' + '═'.repeat(80))
        console.log('📋 FULL TEMPLATE CONTENT (safetyRules):')
        console.log('═'.repeat(80))
        console.log(p.safetyRules || '(empty)')

        console.log('\n' + '═'.repeat(80))
        console.log('📋 FULL TEMPLATE CONTENT (styleRules):')
        console.log('═'.repeat(80))
        console.log(p.styleRules || '(empty)')

        console.log('\n')
    }

    // Also check the Prompt table for base prompts
    console.log('━'.repeat(80))
    console.log('📜 BASE PROMPTS (from Prompt table):')
    console.log('━'.repeat(80))

    const prompts = await prisma.prompt.findMany({
        where: { isActive: true }
    })

    for (const prompt of prompts) {
        console.log(`\n   📌 ${prompt.name} (ID: ${prompt.id})`)
        console.log(`      Model: ${prompt.model}`)
        console.log(`      Prompt length: ${prompt.system_prompt.length} chars`)

        // Show first 500 chars
        console.log(`      Preview: ${prompt.system_prompt.substring(0, 500)}...`)
    }

    await prisma.$disconnect()
}

main().catch(console.error)
