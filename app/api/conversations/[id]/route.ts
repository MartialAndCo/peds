import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const updateConversationSchema = z.object({
    status: z.enum(['active', 'paused', 'closed']).optional(),
    ai_enabled: z.boolean().optional(),
    prompt_id: z.number().optional()
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
            contact: true,
            prompt: true,
        }
    })

    if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(conversation)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    try {
        const json = await req.json()
        const body = updateConversationSchema.parse(json)

        const conversation = await prisma.conversation.update({
            where: { id },
            data: {
                ...body,
                closedAt: body.status === 'closed' ? new Date() : undefined
            }
        })

        return NextResponse.json(conversation)
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
