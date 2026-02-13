import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/admin/migrate-discord-leads - Migrate all Discord leads to the configured Discord agent
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Get the Discord agent from settings
        const discordAgentSetting = await prisma.setting.findUnique({
            where: { key: 'discord_agent_id' }
        })

        if (!discordAgentSetting?.value) {
            return NextResponse.json({ 
                error: 'No Discord agent configured in settings' 
            }, { status: 400 })
        }

        const discordAgentId = discordAgentSetting.value
        const targetAgent = await prisma.agent.findUnique({
            where: { id: discordAgentId },
            select: { id: true, name: true }
        })

        if (!targetAgent) {
            return NextResponse.json({ 
                error: 'Configured Discord agent not found' 
            }, { status: 400 })
        }

        // Find all Discord leads that are NOT already assigned to the Discord agent
        const discordLeads = await prisma.lead.findMany({
            where: {
                type: 'DISCORD',
                agentId: { not: discordAgentId }
            },
            include: {
                contact: {
                    include: {
                        conversations: true,
                        agentContacts: true
                    }
                }
            }
        })

        if (discordLeads.length === 0) {
            return NextResponse.json({
                message: 'No Discord leads need migration',
                migrated: 0,
                agent: targetAgent.name
            })
        }

        // Migrate each lead
        const results = await prisma.$transaction(async (tx) => {
            const migrated = []

            for (const lead of discordLeads) {
                const oldAgentId = lead.agentId

                // 1. Update Lead agentId
                await tx.lead.update({
                    where: { id: lead.id },
                    data: { agentId: discordAgentId }
                })

                // 2. If there's a contact, update related data
                if (lead.contact) {
                    // Update conversations
                    for (const conv of lead.contact.conversations) {
                        await tx.conversation.update({
                            where: { id: conv.id },
                            data: { agentId: discordAgentId }
                        })
                    }

                    // Delete old agentContacts and create new one
                    await tx.agentContact.deleteMany({
                        where: { contactId: lead.contact.id }
                    })

                    await tx.agentContact.create({
                        data: {
                            agentId: discordAgentId,
                            contactId: lead.contact.id,
                            phase: 'CONNECTION'
                        }
                    })
                }

                migrated.push({
                    leadId: lead.id,
                    identifier: lead.identifier,
                    oldAgentId,
                    newAgentId: discordAgentId
                })
            }

            return migrated
        })

        return NextResponse.json({
            success: true,
            message: `Migrated ${results.length} Discord leads to ${targetAgent.name}`,
            migrated: results.length,
            agent: targetAgent.name,
            details: results
        })

    } catch (error: any) {
        console.error('Migrate Discord Leads Error:', error)
        return NextResponse.json({ 
            error: error.message 
        }, { status: 500 })
    }
}

// GET /api/admin/migrate-discord-leads - Preview leads that need migration
export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Get the Discord agent from settings
        const discordAgentSetting = await prisma.setting.findUnique({
            where: { key: 'discord_agent_id' }
        })

        const discordAgentId = discordAgentSetting?.value || null

        // Find all Discord leads
        const discordLeads = await prisma.lead.findMany({
            where: { type: 'DISCORD' },
            include: {
                agent: { select: { id: true, name: true } },
                contact: {
                    select: { 
                        id: true, 
                        name: true,
                        status: true 
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        const needsMigration = discordLeads.filter(l => l.agentId !== discordAgentId)
        const alreadyCorrect = discordLeads.filter(l => l.agentId === discordAgentId)

        return NextResponse.json({
            discordAgentConfigured: discordAgentId,
            totalDiscordLeads: discordLeads.length,
            needsMigration: needsMigration.length,
            alreadyCorrect: alreadyCorrect.length,
            leads: discordLeads.map(l => ({
                id: l.id,
                identifier: l.identifier,
                currentAgent: l.agent.name,
                status: l.status,
                contactStatus: l.contact?.status,
                correct: l.agentId === discordAgentId
            }))
        })

    } catch (error: any) {
        console.error('Preview Discord Leads Error:', error)
        return NextResponse.json({ 
            error: error.message 
        }, { status: 500 })
    }
}
