import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions)
    const agentId = params.id

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Security check: Only ADMIN, PROVIDER (if they own the lead, but this is agent-scoped), 
    // or COLLABORATOR/PROVIDER assigned to this agent can see this.
    const isAllowed =
        session.user.role === 'ADMIN' ||
        ((session.user as any).allowedAgentIds && (session.user as any).allowedAgentIds.includes(agentId))

    if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

        const [
            todayCount,
            thisWeekCount,
            thisMonthCount,
            allTimeCount,
            convertedCount,
            pendingCount,
            byType,
        ] = await Promise.all([
            // Today
            prisma.lead.count({
                where: {
                    agentId: agentId,
                    createdAt: { gte: today }
                }
            }),
            // This week
            prisma.lead.count({
                where: {
                    agentId: agentId,
                    createdAt: { gte: weekAgo }
                }
            }),
            // This month
            prisma.lead.count({
                where: {
                    agentId: agentId,
                    createdAt: { gte: monthStart }
                }
            }),
            // All time
            prisma.lead.count({
                where: { agentId: agentId }
            }),
            // Converted
            prisma.lead.count({
                where: {
                    agentId: agentId,
                    status: 'CONVERTED'
                }
            }),
            // Pending
            prisma.lead.count({
                where: {
                    agentId: agentId,
                    status: 'PENDING'
                }
            }),
            // By type
            prisma.lead.groupBy({
                by: ['type'],
                where: { agentId: agentId },
                _count: { type: true }
            })
        ])

        // Calculate estimated costs ($4 per lead)
        const totalEarnings = allTimeCount * 4
        const weeklyEarnings = thisWeekCount * 4

        return NextResponse.json({
            counts: {
                today: todayCount,
                thisWeek: thisWeekCount,
                thisMonth: thisMonthCount,
                allTime: allTimeCount
            },
            status: {
                converted: convertedCount,
                pending: pendingCount,
                imported: allTimeCount - convertedCount - pendingCount
            },
            byType: byType.reduce((acc: any, curr) => {
                acc[curr.type] = curr._count.type
                return acc
            }, {}),
            earnings: {
                total: totalEarnings,
                thisWeek: weeklyEarnings,
                perLead: 4
            },
            conversionRate: allTimeCount > 0 ? (convertedCount / allTimeCount) * 100 : 0
        })
    } catch (e: any) {
        console.error('Get Agent Leads Stats Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
