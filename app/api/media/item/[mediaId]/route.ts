import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { unlink } from 'fs/promises'
import path from 'path'

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ mediaId: string }> }
) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const { mediaId } = await params
        const id = parseInt(mediaId)

        const media = await prisma.media.findUnique({
            where: { id }
        })

        if (!media) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        await prisma.media.delete({
            where: { id }
        })

        // Attempt to delete file if it's local
        if (media.url.startsWith('/media/')) {
            try {
                const filename = media.url.split('/').pop()
                if (filename) {
                    const filepath = path.join(process.cwd(), 'public', 'media', filename)
                    await unlink(filepath).catch(() => console.log('File not found or could not be deleted:', filepath))
                }
            } catch (e) {
                // ignore file deletion errors
                console.error('Error deleting file', e)
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
