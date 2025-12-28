
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
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
