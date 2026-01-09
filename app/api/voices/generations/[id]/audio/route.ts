
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const generationId = parseInt(id)

    try {
        const generation = await prisma.voiceGeneration.findUnique({
            where: { id: generationId },
            select: { audioUrl: true }
        })

        if (!generation || !generation.audioUrl) {
            return NextResponse.json({ error: 'Not found or processing' }, { status: 404 })
        }

        // Convert Base64 to Buffer
        const base64Data = generation.audioUrl.split('base64,')[1] || generation.audioUrl
        const buffer = Buffer.from(base64Data, 'base64')

        // Return as proper Audio Stream
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': buffer.length.toString(),
            }
        })

    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
