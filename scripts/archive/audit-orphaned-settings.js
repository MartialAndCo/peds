const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function auditOrphanedSettings() {
    console.log('=== ORPHANED SETTINGS AUDIT ===\n')

    // Mapping: Settings key -> AgentProfile field
    const settingsToProfileMapping = {
        'base_role': 'baseRole',
        'personality_instruction': 'personality',
        'context_rules': 'contextRules',
        'content_rules': 'contentRules',
        'payment_rules': 'paymentRules',
        'safety_rules': 'safetyRules',
        'style_rules': 'styleRules',
        'phase_connection_template': 'phaseConnectionTemplate',
        'phase_vulnerability_template': 'phaseVulnerabilityTemplate',
        'phase_crisis_template': 'phaseCrisisTemplate',
        'phase_moneypot_template': 'phaseMoneypotTemplate',
        'paypal_email': 'paypalEmail',
        'cashapp_tag': 'cashappTag',
        'venmo_handle': 'venmoHandle',
        'context_template': 'contextTemplate',
        'mission_template': 'missionTemplate',
        'identity_template': 'identityTemplate'
    }

    // Get all Settings
    const allSettings = await prisma.setting.findMany()
    const orphanedSettings = []
    const legitimateGlobalSettings = []

    for (const setting of allSettings) {
        if (settingsToProfileMapping[setting.key]) {
            orphanedSettings.push(setting)
        } else {
            legitimateGlobalSettings.push(setting)
        }
    }

    console.log('📊 Settings Analysis:\n')
    console.log(`Total Settings: ${allSettings.length}`)
    console.log(`Orphaned (should be in AgentProfile): ${orphanedSettings.length}`)
    console.log(`Legitimate Global: ${legitimateGlobalSettings.length}\n`)

    if (orphanedSettings.length > 0) {
        console.log('⚠️  ORPHANED SETTINGS (should be per-agent):\n')
        for (const s of orphanedSettings) {
            const fieldName = settingsToProfileMapping[s.key]
            console.log(`  ❌ ${s.key} → AgentProfile.${fieldName}`)
            console.log(`     Value: ${s.value?.substring(0, 80)}${s.value?.length > 80 ? '...' : ''}`)
            console.log('')
        }

        console.log('\n💡 RECOMMENDATION:')
        console.log('These settings should be migrated to each agent\'s profile.')
        console.log('After migration, they can be removed from global Settings.\n')
    } else {
        console.log('✅ No orphaned settings found!\n')
    }

    // Check AgentProfiles
    console.log('=== AGENT PROFILES STATUS ===\n')
    const agents = await prisma.agent.findMany({
        include: { profile: true }
    })

    for (const agent of agents) {
        console.log(`Agent: ${agent.name}`)
        if (!agent.profile) {
            console.log(`  ❌ NO PROFILE`)
        } else {
            const missingFields = []
            Object.values(settingsToProfileMapping).forEach(field => {
                if (!agent.profile[field]) missingFields.push(field)
            })

            if (missingFields.length > 0) {
                console.log(`  ⚠️  Profile exists but missing ${missingFields.length} fields`)
                console.log(`     Missing: ${missingFields.join(', ')}`)
            } else {
                console.log(`  ✅ Profile complete`)
            }
        }
        console.log('')
    }
}

auditOrphanedSettings()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect())
