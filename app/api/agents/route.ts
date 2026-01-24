
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const agents = await prisma.agent.findMany({
        where: { isActive: true },
        include: {
            agentPrompts: true,
            settings: true
        },
        orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(agents)
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, phone, color, promptId } = body

    try {
        const { randomUUID } = await import('crypto')
        const wahaId = `session_${randomUUID()}`

        const agent = await prisma.agent.create({
            data: {
                name,
                phone,
                color,
                promptId: promptId ? parseInt(promptId) : undefined,
                settings: {
                    create: [
                        { key: 'waha_id', value: wahaId }
                    ]
                }
            }
        })
        return NextResponse.json(agent)
    } catch (e: any) {
        console.error('Failed to create agent', e)
        return NextResponse.json({ error: e.message || 'Failed to create agent' }, { status: 500 })
    }
}
