import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const beforeId = searchParams.get('before') ? parseInt(searchParams.get('before')!) : undefined

    // Build query for pagination
    const whereClause: any = { conversationId: id }
    if (beforeId) {
        whereClause.id = { lt: beforeId }
    }

    // Get messages in descending order (newest first for pagination), then reverse for display
    const messages = await prisma.message.findMany({
        where: whereClause,
        orderBy: { id: 'desc' }, // Get newest ones relative to cursor
        take: limit
    })

    // Reverse to get chronological order for display
    const messagesAsc = messages.reverse()

    // Check if there are more messages
    const hasMore = messages.length === limit && messages.length > 0
    const oldestId = messagesAsc.length > 0 ? messagesAsc[0].id : null

    return NextResponse.json({
        messages: messagesAsc,
        hasMore,
        oldestId
    })
}
