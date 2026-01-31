const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function forceMigration() {
    try {
        console.log('=== FORCING COMPLETE MIGRATION ===\n')

        // Get Settings
        const settings = await prisma.setting.findMany()
        const s = {}
        settings.forEach(setting => s[setting.key] = setting.value)

        console.log('Settings loaded. Checking key fields:')
        console.log(`  phase_connection_template: ${s['phase_connection_template'] ? 'EXISTS (' + s['phase_connection_template'].length + ' chars)' : 'MISSING'}`)
        console.log(`  phase_vulnerability_template: ${s['phase_vulnerability_template'] ? 'EXISTS (' + s['phase_vulnerability_template'].length + ' chars)' : 'MISSING'}`)
        console.log(`  base_role: ${s['base_role'] ? 'EXISTS' : 'MISSING'}`)
        console.log('')

        // Get agents
        const agents = await prisma.agent.findMany({ include: { profile: true } })
        console.log(`Found ${agents.length} agents\n`)

        for (const agent of agents) {
            console.log(`Processing: ${agent.name}`)

            const data = {
                phaseConnectionTemplate: s['phase_connection_template'] || null,
                phaseVulnerabilityTemplate: s['phase_vulnerability_template'] || null,
                phaseCrisisTemplate: s['phase_crisis_template'] || null,
                phaseMoneypotTemplate: s['phase_moneypot_template'] || null,
                contextTemplate: s['context_template'] || null,
                missionTemplate: s['mission_template'] || null,
                identityTemplate: s['identity_template'] || null,
                paymentRules: s['payment_rules'] || null,
                safetyRules: s['safety_rules'] || null,
                styleRules: s['style_rules'] || null
            }

            if (agent.profile) {
                await prisma.agentProfile.update({
                    where: { agentId: agent.id },
                    data: data
                })
                console.log(`  ✅ Updated`)
            } else {
                await prisma.agentProfile.create({
                    data: {
                        agentId: agent.id,
                        ...data
                    }
                })
                console.log(`  ✅ Created`)
            }
        }

        console.log('\n✅ Migration complete!')

    } catch (error) {
        console.error('\n❌ Error:', error.message)
        console.error(error.stack)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

forceMigration()
