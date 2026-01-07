import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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

        // No file deletion needed as we are using Base64 in URL column or external URLs.
        // If we switch back to S3/File later, we'd add logic here.

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
