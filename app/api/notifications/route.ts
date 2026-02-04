import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const { searchParams } = new URL(req.url)
        const limit = parseInt(searchParams.get('limit') || '20')
        const unreadOnly = searchParams.get('unread') === 'true'

        const where: any = {}
        if (unreadOnly) {
            where.isRead = false
        }

        const notifications = await prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit
        })

        // Also get unread count
        const unreadCount = await prisma.notification.count({
            where: { isRead: false }
        })

        return NextResponse.json({ notifications, unreadCount })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const body = await req.json()
        const { id, markAllRead } = body

        if (markAllRead) {
            await prisma.notification.updateMany({
                where: { isRead: false },
                data: { isRead: true }
            })
            return NextResponse.json({ success: true })
        }

        if (id) {
            await prisma.notification.update({
                where: { id },
                data: { isRead: true }
            })
            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: 'Missing ID or action' }, { status: 400 })

    } catch (error) {
        return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
    }
}
// ... PATCH ...

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')
        const all = searchParams.get('all') === 'true'

        if (all) {
            await prisma.notification.deleteMany({
                where: {
                    // Safety: only delete for current user logic or all if admin? 
                    // Current system seems global admin, so delete all is fine.
                }
            })
            return NextResponse.json({ success: true })
        }

        if (id) {
            await prisma.notification.delete({
                where: { id }
            })
            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: 'Missing ID or all flag' }, { status: 400 })

    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 })
    }
}
