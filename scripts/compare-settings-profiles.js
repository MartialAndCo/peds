const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const prisma = new PrismaClient()

async function compareSettingsVsProfiles() {
    const report = []

    function log(msg) {
        console.log(msg)
        report.push(msg)
    }

    log('=== SETTINGS VS AGENT PROFILES COMPARISON ===\n')

    // Get all Settings
    const settings = await prisma.setting.findMany()
    const settingsMap = {}
    settings.forEach(s => settingsMap[s.key] = s.value)

    log('=== GLOBAL SETTINGS CONTENT ===\n')

    const promptKeys = [
        'base_role',
        'phase_connection_template',
        'phase_vulnerability_template',
        'phase_crisis_template',
        'phase_moneypot_template',
        'context_rules',
        'content_rules',
        'payment_rules',
        'safety_rules',
        'style_rules',
        'context_template',
        'mission_template',
        'identity_template'
    ]

    for (const key of promptKeys) {
        const value = settingsMap[key]
        if (value) {
            log(`📝 ${key}:`)
            log(`   Length: ${value.length} characters`)
            log(`   Preview: ${value.substring(0, 200).replace(/\n/g, ' ')}${value.length > 200 ? '...' : ''}`)
            log('')
        } else {
            log(`❌ ${key}: NOT FOUND in Settings`)
            log('')
        }
    }

    // Get AgentProfiles
    log('\n=== AGENT PROFILES CONTENT ===\n')

    const agents = await prisma.agent.findMany({
        include: { profile: true }
    })

    for (const agent of agents) {
        log(`\n--- Agent: ${agent.name} ---`)

        if (!agent.profile) {
            log('❌ NO PROFILE\n')
            continue
        }

        const p = agent.profile

        // Compare each field
        const comparisons = [
            { field: 'baseRole', settingKey: 'base_role' },
            { field: 'phaseConnectionTemplate', settingKey: 'phase_connection_template' },
            { field: 'phaseVulnerabilityTemplate', settingKey: 'phase_vulnerability_template' },
            { field: 'phaseCrisisTemplate', settingKey: 'phase_crisis_template' },
            { field: 'phaseMoneypotTemplate', settingKey: 'phase_moneypot_template' },
            { field: 'contextTemplate', settingKey: 'context_template' },
            { field: 'missionTemplate', settingKey: 'mission_template' },
            { field: 'identityTemplate', settingKey: 'identity_template' }
        ]

        for (const { field, settingKey } of comparisons) {
            const profileValue = p[field]
            const settingValue = settingsMap[settingKey]

            log(`  ${field}:`)

            if (!profileValue) {
                log(`    ❌ EMPTY in profile`)
            } else if (profileValue.length < 50) {
                log(`    ⚠️  PLACEHOLDER (${profileValue.length} chars): "${profileValue}"`)
            } else if (settingValue && profileValue !== settingValue) {
                log(`    ⚠️  DIFFERENT from Settings`)
                log(`       Profile: ${profileValue.substring(0, 100)}...`)
                log(`       Setting: ${settingValue.substring(0, 100)}...`)
            } else {
                log(`    ✅ Has content (${profileValue.length} chars)`)
            }
        }
        log('')
    }

    // Save report
    fs.writeFileSync('settings-vs-profiles-report.txt', report.join('\n'))
    log('\nReport saved to: settings-vs-profiles-report.txt')
}

compareSettingsVsProfiles()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
