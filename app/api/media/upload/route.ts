import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { storage } from '@/lib/storage'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const mimeType = file.type || 'application/octet-stream'

        // Determine folder based on content type
        let folder = 'chat-media'
        if (mimeType.startsWith('image/')) folder = 'chat-images'
        else if (mimeType.startsWith('video/')) folder = 'chat-videos'
        else if (mimeType.startsWith('audio/')) folder = 'voice-uploads'

        const url = await storage.uploadMedia(buffer, mimeType, folder)

        if (!url) {
            return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
        }

        return NextResponse.json({ url, mimeType, filename: file.name })
    } catch (error: any) {
        console.error('[Media Upload] Error:', error)
        return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 })
    }
}
