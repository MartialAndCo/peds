import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params

        // Find messages in conversations with this contact that have mediaUrl
        // We join via Conversation
        const mediaMessages = await prisma.message.findMany({
            where: {
                conversation: { contactId: id },
                mediaUrl: { not: null }
            },
            orderBy: { timestamp: 'desc' },
            select: {
                id: true,
                mediaUrl: true,
                timestamp: true,
                sender: true,
                message_text: true
            }
        })

        return NextResponse.json(mediaMessages)
    } catch (error) {
        console.error("[API] GET Contact Media error:", error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
