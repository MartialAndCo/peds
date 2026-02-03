
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const bots = await prisma.discordBot.findMany({
        orderBy: { lastSeen: 'desc' },
        include: {
            agent: {
                select: { id: true, name: true, color: true }
            }
        }
    })

    return NextResponse.json(bots)
}

export async function PUT(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { botId, agentId } = body

    if (!botId) return NextResponse.json({ error: 'Missing botId' }, { status: 400 })

    const bot = await prisma.discordBot.update({
        where: { id: botId },
        data: { agentId: agentId || null }
    })

    return NextResponse.json(bot)
}
