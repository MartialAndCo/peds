import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/admin/provider-leads - Get all leads with filters
export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const providerId = searchParams.get('providerId')
        const agentId = searchParams.get('agentId')
        const status = searchParams.get('status')
        const type = searchParams.get('type')
        const from = searchParams.get('from') // Date from
        const to = searchParams.get('to') // Date to
        const limit = parseInt(searchParams.get('limit') || '50')
        const page = parseInt(searchParams.get('page') || '1')
        const skip = (page - 1) * limit

        const where: any = {}
        
        if (providerId) where.providerId = providerId
        if (agentId) where.agentId = agentId
        if (status) where.status = status
        if (type) where.type = type
        
        if (from || to) {
            where.createdAt = {}
            if (from) where.createdAt.gte = new Date(from)
            if (to) where.createdAt.lte = new Date(to)
        }

        const [leads, total, stats] = await Promise.all([
            prisma.lead.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip,
                include: {
                    provider: { select: { id: true, email: true } },
                    agent: { select: { id: true, name: true, color: true } },
                    contact: {
                        select: {
                            id: true,
                            status: true,
                            agentPhase: true,
                            conversations: {
                                take: 1,
                                select: {
                                    status: true,
                                    lastMessageAt: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.lead.count({ where }),
            // Aggregate stats
            prisma.lead.groupBy({
                by: ['status'],
                where: providerId || agentId ? where : {},
                _count: { status: true }
            })
        ])

        // Calculate costs
        const totalCost = total * 4

        return NextResponse.json({
            leads,
            total,
            page,
            pages: Math.ceil(total / limit),
            stats: {
                total,
                totalCost,
                byStatus: stats.reduce((acc: any, curr) => {
                    acc[curr.status] = curr._count.status
                    return acc
                }, {})
            }
        })
    } catch (e: any) {
        console.error('Get Provider Leads Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
