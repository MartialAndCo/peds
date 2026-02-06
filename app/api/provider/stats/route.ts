import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/provider/stats - Get provider statistics
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'PROVIDER') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

        const [
            todayCount,
            thisWeekCount,
            twoWeeksCount,
            thisMonthCount,
            allTimeCount,
            convertedCount,
            pendingCount,
            byType
        ] = await Promise.all([
            // Today
            prisma.lead.count({
                where: {
                    providerId: session.user.id,
                    createdAt: { gte: today }
                }
            }),
            // This week
            prisma.lead.count({
                where: {
                    providerId: session.user.id,
                    createdAt: { gte: weekAgo }
                }
            }),
            // Last 2 weeks
            prisma.lead.count({
                where: {
                    providerId: session.user.id,
                    createdAt: { gte: twoWeeksAgo }
                }
            }),
            // This month
            prisma.lead.count({
                where: {
                    providerId: session.user.id,
                    createdAt: { gte: monthStart }
                }
            }),
            // All time
            prisma.lead.count({
                where: { providerId: session.user.id }
            }),
            // Converted
            prisma.lead.count({
                where: {
                    providerId: session.user.id,
                    status: 'CONVERTED'
                }
            }),
            // Pending
            prisma.lead.count({
                where: {
                    providerId: session.user.id,
                    status: 'PENDING'
                }
            }),
            // By type
            prisma.lead.groupBy({
                by: ['type'],
                where: { providerId: session.user.id },
                _count: { type: true }
            })
        ])

        // Calculate estimated earnings ($4 per lead)
        const totalEarnings = allTimeCount * 4
        const weeklyEarnings = thisWeekCount * 4

        return NextResponse.json({
            counts: {
                today: todayCount,
                thisWeek: thisWeekCount,
                twoWeeks: twoWeeksCount,
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
            }
        })
    } catch (e: any) {
        console.error('Get Provider Stats Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
