
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        // Fetch all media types with their media
        const mediaTypes = await prisma.mediaType.findMany({
            include: {
                medias: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        })

        // Also fetch uncategorized or check if logic allows media without type
        // Currently schema enforces typeId, so all media must have a type.

        return NextResponse.json(mediaTypes)
    } catch (error: any) {
        console.error('Media API Error:', error)
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const json = await req.json()
        const { id, description, keywords } = json

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

        const mediaType = await prisma.mediaType.create({
            data: {
                id,
                description,
                keywords: keywords || []
            }
        })
        return NextResponse.json(mediaType)
    } catch (error: any) {
        if (error.code === 'P2002') return NextResponse.json({ error: 'Category ID already exists' }, { status: 409 })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
