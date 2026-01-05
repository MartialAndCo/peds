
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { name, phone, color, promptId, isActive } = body

    try {
        const agent = await prisma.agent.update({
            where: { id: parseInt(id) },
            data: {
                name,
                phone,
                color,
                promptId: promptId ? parseInt(promptId) : null,
                isActive
            }
        })
        return NextResponse.json(agent)
    } catch (e) {
        console.error('Failed to update agent', e)
        return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    try {
        // Soft delete or real delete? Real delete for now unless linked data prevents it.
        // We'll soft delete by setting isActive = false if deletion fails
        await prisma.agent.delete({
            where: { id: parseInt(id) }
        })
        return NextResponse.json({ success: true })
    } catch (e) {
        // Fallback to archiving if deletion barred by constraints
        return NextResponse.json({ error: 'Cannot delete active agent with data' }, { status: 400 })
    }
}
