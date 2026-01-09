
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    // Note: We bypass session check for <audio> src sometimes because browsers handle cookies weirdly
    // BUT since we are on same domain, cookies *should* pass. 
    // If user says it fails, we might need to allow public access via token query param.
    // Keeping auth for now.
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
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const base64Data = generation.audioUrl.split('base64,')[1] || generation.audioUrl
        const buffer = Buffer.from(base64Data, 'base64')
        const totalSize = buffer.length

        // Handle Range Requests (Critical for Amplify 6MB Limit)
        const range = req.headers.get('range')

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-')
            const start = parseInt(parts[0], 10)
            const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1
            const chunksize = (end - start) + 1

            const slicedBuffer = buffer.subarray(start, end + 1)

            return new NextResponse(slicedBuffer, {
                status: 206,
                headers: {
                    'Content-Range': `bytes ${start}-${end}/${totalSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize.toString(),
                    'Content-Type': 'audio/mpeg',
                }
            })
        } else {
            // Full content (Might fail if > 6MB on Amplify)
            return new NextResponse(buffer, {
                headers: {
                    'Content-Length': totalSize.toString(),
                    'Content-Type': 'audio/mpeg',
                }
            })
        }

    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
