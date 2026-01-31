const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function migratePromptsCorrectly() {
    console.log('=== CORRECT MIGRATION WITH REAL KEYS ===\n')

    // Get Settings
    const settings = await prisma.setting.findMany()
    const s = {}
    settings.forEach(setting => s[setting.key] = setting.value)

    console.log('Mapping Settings to AgentProfile fields:\n')

    const mapping = {
        // Templates
        'prompt_identity_template': 'identityTemplate',
        'prompt_context_template': 'contextTemplate',
        'prompt_mission_template': 'missionTemplate',

        // Phase Templates
        'phase_prompt_connection': 'phaseConnectionTemplate',
        'phase_prompt_vulnerability': 'phaseVulnerabilityTemplate',
        'phase_prompt_crisis': 'phaseCrisisTemplate',
        'phase_prompt_moneypot': 'phaseMoneypotTemplate',

        // Rules
        'prompt_payment_rules': 'paymentRules',
        'prompt_style_instructions': 'styleRules'
    }

    // Build combined safetyRules from multiple sources
    const safetyRulesParts = [
        s['prompt_global_rules'],
        s['prompt_social_media_rules'],
        s['prompt_image_handling_rules'],
        s['prompt_voice_note_policy'],
        s['prompt_guardrails']
    ].filter(Boolean)

    const safetyRules = safetyRulesParts.join('\n\n')

    // Show what we're migrating
    Object.entries(mapping).forEach(([key, field]) => {
        const val = s[key]
        console.log(`  ${key} → ${field}: ${val ? val.length + ' chars' : 'MISSING'}`)
    })
    console.log(`  [combined] → safetyRules: ${safetyRules.length} chars\n`)

    // Get agents
    const agents = await prisma.agent.findMany({ include: { profile: true } })
    console.log(`Processing ${agents.length} agents:\n`)

    for (const agent of agents) {
        console.log(`--- ${agent.name} ---`)

        const data = {
            // Templates
            identityTemplate: s['prompt_identity_template'] || null,
            contextTemplate: s['prompt_context_template'] || null,
            missionTemplate: s['prompt_mission_template'] || null,

            // Phase Templates
            phaseConnectionTemplate: s['phase_prompt_connection'] || null,
            phaseVulnerabilityTemplate: s['phase_prompt_vulnerability'] || null,
            phaseCrisisTemplate: s['phase_prompt_crisis'] || null,
            phaseMoneypotTemplate: s['phase_prompt_moneypot'] || null,

            // Rules
            paymentRules: s['prompt_payment_rules'] || null,
            styleRules: s['prompt_style_instructions'] || null,
            safetyRules: safetyRules || null
        }

        const filledFields = Object.entries(data).filter(([k, v]) => v).length
        console.log(`  Migrating ${filledFields} fields`)

        if (agent.profile) {
            await prisma.agentProfile.update({
                where: { agentId: agent.id },
                data
            })
            console.log(`  ✅ Updated profile\n`)
        } else {
            await prisma.agentProfile.create({
                data: { agentId: agent.id, ...data }
            })
            console.log(`  ✅ Created profile\n`)
        }
    }

    console.log('✅ MIGRATION COMPLETE!')
    console.log('\nVerify in Prisma Studio: AgentProfile table should now have all templates and rules.')
}

migratePromptsCorrectly()
    .catch(e => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
