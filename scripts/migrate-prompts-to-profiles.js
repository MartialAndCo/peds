const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function migratePromptsToAgentProfiles() {
    console.log('=== PROMPT MIGRATION TO AGENT PROFILES ===\n')

    // 1. Fetch all global settings
    const settings = await prisma.setting.findMany()
    const settingsMap = {}
    settings.forEach(s => settingsMap[s.key] = s.value)

    console.log(`Found ${settings.length} global settings\n`)

    // 2. Fetch all agents  
    const agents = await prisma.agent.findMany({
        include: { profile: true }
    })

    console.log(`Found ${agents.length} agents:\n`)

    // 3. For each agent, create or update their profile with prompt data from Settings
    for (const agent of agents) {
        console.log(`\n--- Agent: ${agent.name} ---`)

        if (agent.profile) {
            console.log('  ✅ Already has profile - checking if update needed...')

            // Check if profile has the phase templates
            if (agent.profile.phaseConnectionTemplate) {
                console.log('  ⏭️  Profile already has phase templates - skipping')
                continue
            }
        }

        // Prepare profile data from global settings
        const profileData = {
            baseRole: settingsMap['base_role'] || 'You are a friend',
            personality: settingsMap['personality_instruction'] || null,
            contextRules: settingsMap['context_rules'] || null,
            contentRules: settingsMap['content_rules'] || null,
            paymentRules: settingsMap['payment_rules'] || null,
            safetyRules: settingsMap['safety_rules'] || null,
            styleRules: settingsMap['style_rules'] || null,

            // Phase templates
            phaseConnectionTemplate: settingsMap['phase_connection_template'] || null,
            phaseVulnerabilityTemplate: settingsMap['phase_vulnerability_template'] || null,
            phaseCrisisTemplate: settingsMap['phase_crisis_template'] || null,
            phaseMoneypotTemplate: settingsMap['phase_moneypot_template'] || null,

            // Payment methods
            paypalEmail: settingsMap['paypal_email'] || null,
            cashappTag: settingsMap['cashapp_tag'] || null,
            venmoHandle: settingsMap['venmo_handle'] || null
        }

        console.log('  📝 Migrating prompt data to profile...')

        if (agent.profile) {
            // Update existing profile
            await prisma.agentProfile.update({
                where: { agentId: agent.id },
                data: profileData
            })
            console.log('  ✅ Updated existing profile')
        } else {
            // Create new profile
            await prisma.agentProfile.create({
                data: {
                    agentId: agent.id,
                    ...profileData
                }
            })
            console.log('  ✅ Created new profile')
        }
    }

    console.log('\n=== MIGRATION COMPLETE ===')
    console.log('\nNow verify in Prisma Studio that each agent has their profile with phase templates.')
    console.log('\nAfter verification, you can optionally clean up Settings table.')
}

migratePromptsToAgentProfiles()
    .catch(e => {
        console.error('❌ Migration failed:', e.message)
        console.error(e.stack)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
