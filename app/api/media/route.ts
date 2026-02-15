import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const typeId = searchParams.get('typeId')
        const limit = parseInt(searchParams.get('limit') || '50')

        const where: any = {}
        if (typeId) where.typeId = typeId

        const medias = await prisma.media.findMany({
            where,
            include: { type: true },
            orderBy: { createdAt: 'desc' },
            take: limit
        })

        // Also fetch media types for filtering
        const types = await prisma.mediaType.findMany({
            orderBy: { id: 'asc' }
        })

        return NextResponse.json({ medias, types })
    } catch (error: any) {
        console.error('[API] GET /media error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
