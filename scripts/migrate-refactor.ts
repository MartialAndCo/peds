import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting Migration Refactor...')

    // 1. Migrate Settings -> AgentProfile
    const globalSettings = await prisma.setting.findMany()
    const settingsMap = globalSettings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {} as Record<string, string>)

    const agents = await prisma.agent.findMany()

    for (const agent of agents) {
        console.log(`Processing Agent: ${agent.name} (${agent.id})`)

        // Fetch Agent Specific Settings overrides
        const agentSettings = await prisma.agentSetting.findMany({ where: { agentId: agent.id } })
        const overrides = agentSettings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {} as Record<string, string>)

        const getVal = (key: string) => overrides[key] || settingsMap[key] || null
        const getInt = (key: string, def: number) => {
            const v = getVal(key)
            return v ? parseInt(v) : def
        }

        await prisma.agentProfile.upsert({
            where: { agentId: agent.id },
            create: {
                agentId: agent.id,
                baseAge: getInt('agent_base_age', 18),
                locale: getVal('agent_locale') || 'en-US',
                timezone: getVal('helper_timezone') || 'America/Los_Angeles',

                contextTemplate: getVal('prompt_context_template') || '',
                missionTemplate: getVal('prompt_mission_template') || '',
                identityTemplate: getVal('prompt_identity_template') || '',

                paymentRules: getVal('prompt_payment_rules') || '',
                safetyRules: getVal('prompt_guardrails') || '',

                paypalEmail: getVal('payment_paypal_username') || getVal('paypal_username'),
                cashappTag: getVal('payment_cashapp_username'),
                venmoHandle: getVal('payment_venmo_username'),

                fastTrackDays: getInt('phase_days_fast_connection', 2)
            },
            update: {
                // Force update to ensure global settings are applied if profile exists empty
                baseAge: getInt('agent_base_age', 18),
                locale: getVal('agent_locale') || 'en-US',
                contextTemplate: getVal('prompt_context_template') || '',
                missionTemplate: getVal('prompt_mission_template') || '',
                identityTemplate: getVal('prompt_identity_template') || '',
                paymentRules: getVal('prompt_payment_rules') || '',
                safetyRules: getVal('prompt_guardrails') || '',
            }
        })
        console.log(`- Profile created/updated for ${agent.name}`)
    }

    // 2. Migrate Contact State -> AgentContact
    const contacts = await prisma.contact.findMany({
        include: {
            conversations: true
        }
    })

    console.log(`Processing ${contacts.length} Contacts for State Isolation...`)

    for (const contact of contacts) {
        // Find unique agents this contact has interacted with
        const agentIds = new Set<number>()

        contact.conversations.forEach(c => {
            if (c.agentId) agentIds.add(c.agentId)
        })

        for (const agentId of Array.from(agentIds)) {
            // Check if exists
            const existing = await prisma.agentContact.findUnique({
                where: {
                    agentId_contactId: {
                        agentId,
                        contactId: contact.id
                    }
                }
            })

            if (!existing) {
                await prisma.agentContact.create({
                    data: {
                        agentId,
                        contactId: contact.id,
                        trustScore: contact.trustScore, // COPY GLOBAL TO LOCAL
                        phase: contact.agentPhase,      // COPY GLOBAL TO LOCAL
                        lastPhaseUpdate: contact.lastPhaseUpdate,
                        lastTrustAnalysis: contact.lastTrustAnalysis,
                        messageCount: 0
                    }
                })
                console.log(`- Created AgentContact for User ${contact.phone_whatsapp} <-> Agent ${agentId}`)
            }
        }
    }

    console.log('Migration Complete!')
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
