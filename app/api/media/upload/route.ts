import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File
        const categoryId = formData.get('categoryId') as string

        if (!file || !categoryId) {
            return NextResponse.json({ error: 'File and categoryId required' }, { status: 400 })
        }

        // Convert file to Base64 to avoid filesystem issues in serverless (Amplify/Vercel)
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const mimeType = file.type || 'application/octet-stream'
        const base64Data = buffer.toString('base64')
        const dataUrl = `data:${mimeType};base64,${base64Data}`

        const media = await prisma.media.create({
            data: {
                typeId: categoryId,
                url: dataUrl,
                sentTo: []
            }
        })

        return NextResponse.json(media)
    } catch (error: any) {
        console.error('Upload error:', error)
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
    }
}
