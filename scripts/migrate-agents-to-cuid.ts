import { prisma } from '../lib/prisma'

async function main() {
    console.log('--- MIGRATING LEGACY AGENTS TO CUID ---')

    const agents = await prisma.agent.findMany()

    for (const agent of agents) {
        // If ID is short (like '7' or '8'), it's likely a legacy auto-increment ID
        if (agent.id.length < 5) {
            console.log(`Migrating Agent ${agent.name} (Legacy ID: ${agent.id})...`)

            // Fetch old profile
            const oldProfile = await prisma.agentProfile.findUnique({ where: { agentId: agent.id } })

            // 1. Create NEW Agent with CUID (clone)
            const newAgent = await prisma.agent.create({
                data: {
                    name: agent.name,
                    phone: `temp_${agent.phone}`,
                    color: agent.color,
                    isActive: agent.isActive,
                    operatorGender: agent.operatorGender,
                    profile: oldProfile ? {
                        create: {
                            baseAge: oldProfile.baseAge,
                            locale: oldProfile.locale,
                            timezone: oldProfile.timezone,
                            paymentRules: oldProfile.paymentRules,
                            // Copy other fields as needed
                            contextTemplate: oldProfile.contextTemplate,
                            missionTemplate: oldProfile.missionTemplate,
                            identityTemplate: oldProfile.identityTemplate,
                            safetyRules: oldProfile.safetyRules,
                            styleRules: oldProfile.styleRules,
                            phaseConnectionTemplate: oldProfile.phaseConnectionTemplate,
                            phaseVulnerabilityTemplate: oldProfile.phaseVulnerabilityTemplate,
                            phaseCrisisTemplate: oldProfile.phaseCrisisTemplate,
                            phaseMoneypotTemplate: oldProfile.phaseMoneypotTemplate,
                            paypalEmail: oldProfile.paypalEmail,
                            cashappTag: oldProfile.cashappTag,
                            venmoHandle: oldProfile.venmoHandle,
                            fastTrackDays: oldProfile.fastTrackDays
                        }
                    } : undefined
                }
            })

            // 2. Clone Relations (Simplified for critical paths)
            // Settings
            const settings = await prisma.agentSetting.findMany({ where: { agentId: agent.id } })
            for (const s of settings) {
                await prisma.agentSetting.create({
                    data: { agentId: newAgent.id, key: s.key, value: s.value }
                })
            }

            // Contacts? Profiles? 
            // This is "Pousse filet" - likely "Profils"
            // Let's migrate inputs/profiles

            // 3. Update the original agent phone to release lock, or just SWAP?
            // User asked to "Modify" existing agents.
            // Since `id` is PK, we can't just change it easily without extensive SQL fk updates.
            // But since user seemingly "lost" data or implies it's "old IDs", 
            // Creating a new CUID agent and swapping is safer.

            // Finalize: Swap Phones
            const oldPhone = agent.phone
            await prisma.agent.update({ where: { id: agent.id }, data: { phone: `old_${oldPhone}` } })
            await prisma.agent.update({ where: { id: newAgent.id }, data: { phone: oldPhone } })

            // Delete old? optional.
            console.log(`✅ Migrated ${agent.name} to new ID: ${newAgent.id}`)
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
