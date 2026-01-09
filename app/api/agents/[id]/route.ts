
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { whatsapp } from '@/lib/whatsapp'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { name, phone, color, promptId, isActive, voiceModelId, operatorGender } = body

    try {
        // Transaction to update basic fields AND upsert settings
        const [agent] = await prisma.$transaction([
            prisma.agent.update({
                where: { id: parseInt(id) },
                data: {
                    name,
                    phone,
                    color,
                    promptId: promptId ? parseInt(promptId) : null,
                    voiceModelId: voiceModelId ? parseInt(voiceModelId) : null,
                    operatorGender,
                    isActive
                }
            }),
            ...(body.settings ? Object.entries(body.settings).map(([key, value]) =>
                prisma.agentSetting.upsert({
                    where: { agentId_key: { agentId: parseInt(id), key } },
                    update: { value: String(value) },
                    create: { agentId: parseInt(id), key, value: String(value) }
                })
            ) : [])
        ])
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
        // 1. Clean up WhatsApp session (stop + delete auth data)
        // This prevents orphan sessions from reconnecting infinitely
        await whatsapp.deleteSession(id)
        console.log(`[Agent Delete] WhatsApp session ${id} cleaned up`)

        // 2. Delete from database
        await prisma.agent.delete({
            where: { id: parseInt(id) }
        })
        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('Failed to delete agent', e)
        // Fallback to archiving if deletion barred by constraints
        return NextResponse.json({ error: 'Cannot delete active agent with data' }, { status: 400 })
    }
}
