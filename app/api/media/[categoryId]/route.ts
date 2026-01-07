import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ categoryId: string }> }
) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const { categoryId } = await params

        // This will cascade delete associated medias due to relation or we rely on prisma
        // If cascade is not set in DB, we might need to delete medias first. 
        // Usage: await prisma.media.deleteMany({ where: { typeId: categoryId } })
        // But likely we want to let Prisma/DB handle it if configured, or do it manually to be safe.
        // Checking schema: "type MediaType" -> "medias Media[]". No "onDelete: Cascade" shown in the view I saw earlier? 
        // Let's safe delete.

        await prisma.media.deleteMany({
            where: { typeId: categoryId }
        })

        await prisma.mediaType.delete({
            where: { id: categoryId }
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
