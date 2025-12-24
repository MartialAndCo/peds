import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const promptSchema = z.object({
    name: z.string().min(3).max(255).optional(),
    system_prompt: z.string().min(10).max(5000).optional(),
    model: z.string().optional(),
    temperature: z.number().min(0).max(1).optional(),
    max_tokens: z.number().min(50).max(2000).optional(),
    isActive: z.boolean().optional(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const prompt = await prisma.prompt.findUnique({
        where: { id }
    })

    if (!prompt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(prompt)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    try {
        const json = await req.json()
        const body = promptSchema.parse(json)

        if (body.isActive) {
            // Deactivate all others, then update this one
            const [_, prompt] = await prisma.$transaction([
                prisma.prompt.updateMany({ where: { id: { not: id } }, data: { isActive: false } }),
                prisma.prompt.update({
                    where: { id },
                    data: body
                })
            ])
            return NextResponse.json(prompt)
        } else {
            const prompt = await prisma.prompt.update({
                where: { id },
                data: body
            })
            return NextResponse.json(prompt)
        }
    } catch (error: any) {
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    try {
        await prisma.prompt.delete({
            where: { id }
        })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
