const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function forceCompleteMigration() {
    console.log('=== FORCING COMPLETE MIGRATION ===\n')
    console.log('This will OVERWRITE all AgentProfile fields with Settings content\n')

    // 1. Get all Settings
    const settings = await prisma.setting.findMany()
    const settingsMap = {}
    settings.forEach(s => settingsMap[s.key] = s.value)

    console.log('Loaded Settings:\n')
    Object.keys(settingsMap).forEach(key => {
        if (key.includes('template') || key.includes('role') || key.includes('rules')) {
            const val = settingsMap[key]
            console.log(`  ${key}: ${val ? val.length + ' chars' : 'null'}`)
        }
    })

    // 2. Get all agents
    const agents = await prisma.agent.findMany({
        include: { profile: true }
    })

    console.log(`\nProcessing ${agents.length} agents:\n`)

    // 3. For each agent, FORCE update with Settings content
    for (const agent of agents) {
        console.log(`\n--- ${agent.name} ---`)

        const profileData = {
            // Base
            baseRole: settingsMap['base_role'] || null,

            // Templates
            contextTemplate: settingsMap['context_template'] || null,
            missionTemplate: settingsMap['mission_template'] || null,
            identityTemplate: settingsMap['identity_template'] || null,

            // Rules
            paymentRules: settingsMap['payment_rules'] || null,
            safetyRules: settingsMap['safety_rules'] || null,
            styleRules: settingsMap['style_rules'] || null,

            // Phase Templates - FORCE OVERWRITE
            phaseConnectionTemplate: settingsMap['phase_connection_template'] || null,
            phaseVulnerabilityTemplate: settingsMap['phase_vulnerability_template'] || null,
            phaseCrisisTemplate: settingsMap['phase_crisis_template'] || null,
            phaseMoneypotTemplate: settingsMap['phase_moneypot_template'] || null,
        }

        // Log what we're migrating
        console.log('Migrating:')
        Object.entries(profileData).forEach(([key, val]) => {
            if (val) {
                console.log(`  ✅ ${key}: ${val.length} chars`)
            } else {
                console.log(`  ⏭️  ${key}: (null)`)
            }
        })

        if (agent.profile) {
            // UPDATE existing
            await prisma.agentProfile.update({
                where: { agentId: agent.id },
                data: profileData
            })
            console.log('✅ Updated profile')
        } else {
            // CREATE new
            await prisma.agentProfile.create({
                data: {
                    agentId: agent.id,
                    ...profileData
                }
            })
            console.log('✅ Created profile')
        }
    }

    console.log('\n=== MIGRATION COMPLETE ===')
    console.log('\nVerify in Prisma Studio:')
    console.log('1. Open AgentProfile table')
    console.log('2. Check that phaseConnectionTemplate, etc. have real content')
    console.log('3. Compare with Settings table to confirm match')
}

forceCompleteMigration()
    .catch(e => {
        console.error('\n❌ ERROR:', e.message)
        console.error(e.stack)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
