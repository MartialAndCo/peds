// Script pour exporter tous les AgentProfile de la base de données
import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function exportProfiles() {
    try {
        const profiles = await prisma.agentProfile.findMany({
            include: {
                agent: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                }
            }
        })

        console.log(`Found ${profiles.length} profiles`)

        for (const profile of profiles) {
            const filename = `profile-export-${profile.agent?.name || 'unknown'}-${Date.now()}.json`
            const data = {
                agent: profile.agent,
                profile: {
                    id: profile.id,
                    agentId: profile.agentId,
                    baseAge: profile.baseAge,
                    locale: profile.locale,
                    timezone: profile.timezone,
                    contextTemplate: profile.contextTemplate,
                    missionTemplate: profile.missionTemplate,
                    identityTemplate: profile.identityTemplate,
                    paymentRules: profile.paymentRules,
                    safetyRules: profile.safetyRules,
                    styleRules: profile.styleRules,
                    phaseConnectionTemplate: profile.phaseConnectionTemplate,
                    phaseVulnerabilityTemplate: profile.phaseVulnerabilityTemplate,
                    phaseCrisisTemplate: profile.phaseCrisisTemplate,
                    phaseMoneypotTemplate: profile.phaseMoneypotTemplate,
                    paypalEmail: profile.paypalEmail,
                    cashappTag: profile.cashappTag,
                    venmoHandle: profile.venmoHandle,
                    bankAccountNumber: profile.bankAccountNumber,
                    bankRoutingNumber: profile.bankRoutingNumber,
                    fastTrackDays: profile.fastTrackDays,
                    createdAt: profile.createdAt,
                    updatedAt: profile.updatedAt
                }
            }

            fs.writeFileSync(`./${filename}`, JSON.stringify(data, null, 2))
            console.log(`Exported: ${filename}`)

            // Print summary
            console.log(`\n=== ${profile.agent?.name || 'Unknown'} ===`)
            console.log(`Locale: ${profile.locale}`)
            console.log(`Timezone: ${profile.timezone}`)
            console.log(`Base Age: ${profile.baseAge}`)
            console.log(`Has contextTemplate: ${!!profile.contextTemplate}`)
            console.log(`Has identityTemplate: ${!!profile.identityTemplate}`)
            console.log(`Has styleRules: ${!!profile.styleRules}`)
            console.log(`Has phaseCrisisTemplate: ${!!profile.phaseCrisisTemplate}`)
            console.log(`PayPal: ${profile.paypalEmail || 'N/A'}`)
            console.log('================================\n')
        }

        // Export all in one file
        fs.writeFileSync('./all-profiles-export.json', JSON.stringify(profiles, null, 2))
        console.log('Exported all profiles to all-profiles-export.json')

    } catch (error) {
        console.error('Error exporting profiles:', error)
    } finally {
        await prisma.$disconnect()
    }
}

exportProfiles()
