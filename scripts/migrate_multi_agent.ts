import { prisma } from '../lib/prisma'

async function migrate() {
    console.log('Starting Migration: Global Settings -> Agent Settings...')

    // 1. Get or Create Default Agent
    let agent = await prisma.agent.findFirst()
    if (!agent) {
        console.log('No agent found. Creating default "Lena"...')
        agent = await prisma.agent.create({
            data: {
                name: 'Lena',
                phone: 'DEFAULT_PHONE', // Should be replaced by user later or checked against env
                color: '#FF0080'
            }
        })
    }
    console.log(`Target Agent: ${agent.name} (ID: ${agent.id})`)

    // 2. Fetch Global Settings
    const allSettings = await prisma.setting.findMany()
    console.log(`Found ${allSettings.length} global settings.`)

    // 3. Filter & Move Agent-Specific Keys
    // Keys like 'voice_id', 'welcome_message', 'prompt_*', 'phase_*' should move.
    // Keys like 'anthropic_api_key', 'stripe_secret' should stay.

    const agentKeys = [
        'voice_id', 'voice_response_enabled',
        'welcome_message',
        'prompt_identity_template', 'prompt_context_template', 'prompt_mission_template',
        'prompt_guardrails', 'prompt_global_rules',
        'phase_prompt_connection', 'phase_prompt_vulnerability', 'phase_prompt_crisis', 'phase_prompt_moneypot',
        'paypal_username'
    ]

    for (const setting of allSettings) {
        if (agentKeys.includes(setting.key)) {
            console.log(`Migrating key: ${setting.key}...`)

            // Create AgentSetting
            await prisma.agentSetting.upsert({
                where: {
                    agentId_key: {
                        agentId: agent.id,
                        key: setting.key
                    }
                },
                update: { value: setting.value },
                create: {
                    agentId: agent.id,
                    key: setting.key,
                    value: setting.value
                }
            })

            // Optional: Delete from Global Settings? 
            // Better to keep for now as backup or fallback, but logic will change to ignore them.
        }
    }

    console.log('Migration Complete!')
}

migrate()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
