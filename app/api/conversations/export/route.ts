import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subHours, subDays } from 'date-fns'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const agentId = searchParams.get('agentId')
        const period = searchParams.get('period') // '24h', '48h', '7d', 'all'

        if (!agentId) {
            return NextResponse.json(
                { error: 'agentId is required' },
                { status: 400 }
            )
        }

        let dateFilter = {}
        const now = new Date()

        if (period === '24h') {
            dateFilter = { gte: subHours(now, 24) }
        } else if (period === '48h') {
            dateFilter = { gte: subHours(now, 48) }
        } else if (period === '7d') {
            dateFilter = { gte: subDays(now, 7) }
        }
        // if 'all', dateFilter remains empty for no filter

        const whereClause: any = { agentId }
        if (Object.keys(dateFilter).length > 0) {
            whereClause.lastMessageAt = dateFilter
        }

        const conversations = await prisma.conversation.findMany({
            where: whereClause,
            include: {
                contact: {
                    select: {
                        id: true,
                        name: true,
                        phone_whatsapp: true,
                        discordId: true,
                    }
                },
                messages: {
                    orderBy: {
                        timestamp: 'asc'
                    },
                    select: {
                        id: true,
                        sender: true,
                        message_text: true,
                        timestamp: true,
                        waha_message_id: true,
                        mediaUrl: true
                    }
                }
            },
            orderBy: {
                lastMessageAt: 'desc'
            }
        })

        const exportData = conversations.map((conv: any) => ({
            conversationId: conv.id,
            contact: conv.contact,
            status: conv.status,
            priority: conv.priority,
            unreadCount: conv.unreadCount,
            lastMessageAt: conv.lastMessageAt,
            createdAt: conv.createdAt,
            messages: conv.messages
        }))

        // Return as a downloadable JSON file
        return new NextResponse(JSON.stringify(exportData, null, 2), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="export-conversations-${agentId}-${period || 'all'}.json"`,
            },
        })

    } catch (error) {
        console.error('Error exporting conversations:', error)
        return NextResponse.json(
            { error: 'Failed to export conversations' },
            { status: 500 }
        )
    }
}
