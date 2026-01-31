import { prisma } from '../lib/prisma'

async function main() {
    console.log('Starting Migration Repair: Validating Prompt Templates...')

    // 1. Fetch Global Settings
    const settings = await prisma.setting.findMany()
    const sMap = new Map(settings.map(s => [s.key, s.value]))

    // 2. Fetch all Profiles
    const profiles = await prisma.agentProfile.findMany()
    console.log(`Found ${profiles.length} profiles to update.`)

    // 3. Prepare Data
    const data = {
        // Identity & Core
        identityTemplate: sMap.get('prompt_identity_template'),
        contextTemplate: sMap.get('prompt_context_template'),
        missionTemplate: sMap.get('prompt_mission_template'),

        // Phases
        phaseConnectionTemplate: sMap.get('phase_prompt_connection'),
        phaseVulnerabilityTemplate: sMap.get('phase_prompt_vulnerability'),
        phaseCrisisTemplate: sMap.get('phase_prompt_crisis'),
        phaseMoneypotTemplate: sMap.get('phase_prompt_moneypot'),

        // Rules
        paymentRules: sMap.get('prompt_payment_rules'),
        styleRules: sMap.get('prompt_style_instructions'),

        // Safety (Aggregated)
        safetyRules: [
            sMap.get('prompt_global_rules'),
            sMap.get('prompt_guardrails'),
            sMap.get('prompt_social_media_rules'),
            sMap.get('prompt_image_handling_rules'),
        ].filter(Boolean).join('\n\n')
    }

    // 4. Update Each Profile
    for (const p of profiles) {
        console.log(`Updating Profile for Agent ${p.agentId}...`)

        await prisma.agentProfile.update({
            where: { id: p.id },
            data: {
                // Only update if the target field is currently null/empty or we want to force overwrite?
                // User complained the migration was BAD. So force overwrite is safer to ensure they get the "Correct" settings.
                ...data
            }
        })
    }

    console.log('Migration Repair Complete.')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
