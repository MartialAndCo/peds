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
        take: limit,
        select: {
            id: true,
            conversationId: true,
            sender: true,
            message_text: true,
            mediaUrl: true,
            status: true,
            timestamp: true,
            waha_message_id: true,
        }
    })

    // Reverse to get chronological order for display
    const messagesAsc = messages.reverse()

    // Strip base64 data URIs from mediaUrl to prevent payload bloat (413 errors)
    // Legacy base64 data has been migrated to Supabase.
    // This now acts as a safety guard: better to show no image than crash the whole chat with 413.
    const sanitizedMessages = messagesAsc.map(m => {
        if (m.mediaUrl && m.mediaUrl.startsWith('data:')) {
            console.warn(`[API] Stripped base64 media from message ${m.id} to prevent 413 error.`)
            return { ...m, mediaUrl: null }
        }
        return m
    })

    // Check if there are more messages
    const hasMore = messages.length === limit && messages.length > 0
    const oldestId = messagesAsc.length > 0 ? messagesAsc[0].id : null

    return NextResponse.json({
        messages: messagesAsc,
        hasMore,
        oldestId
    })
}
