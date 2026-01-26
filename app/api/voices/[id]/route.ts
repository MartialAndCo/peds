
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    try {
        await prisma.voiceModel.delete({
            where: { id: parseInt(id) }
        })
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: 'Failed to delete voice' }, { status: 500 })
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    try {
        const body = await req.json()
        const { name, voiceSampleUrl, gender, language } = body

        const voice = await prisma.voiceModel.update({
            where: { id: parseInt(id) },
            data: {
                ...(name && { name }),
                ...(voiceSampleUrl && { voiceSampleUrl }),
                ...(gender && { gender }),
                ...(language && { language })
            }
        })
        return NextResponse.json(voice)
    } catch (e) {
        return NextResponse.json({ error: 'Failed to update voice' }, { status: 500 })
    }
}
