
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
        const MAX_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB (Safe below 6MB Lambda limit)

        // Handle Range Requests (Critical for Amplify 6MB Limit)
        const range = req.headers.get('range')

        let start = 0
        let end = totalSize - 1

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-')
            start = parseInt(parts[0], 10)
            if (parts[1]) end = parseInt(parts[1], 10)
        }

        // ENFORCE MAX CHUNK SIZE
        // Even if browser asked for "0-" (everything), we cut it at 4MB
        if ((end - start + 1) > MAX_CHUNK_SIZE) {
            end = start + MAX_CHUNK_SIZE - 1
        }

        const chunksize = (end - start) + 1
        const slicedBuffer = buffer.subarray(start, end + 1)

        return new NextResponse(slicedBuffer, {
            status: 206, // Always returned Partial Content for large files
            headers: {
                'Content-Range': `bytes ${start}-${end}/${totalSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize.toString(),
                'Content-Type': 'audio/wav',
            }
        })

    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
