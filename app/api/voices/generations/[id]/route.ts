
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    try {
        await prisma.voiceGeneration.delete({
            where: { id: parseInt(id) }
        })
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }
}
