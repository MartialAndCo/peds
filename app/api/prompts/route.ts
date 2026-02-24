import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const promptSchema = z.object({
    name: z.string().min(3).max(255),
    system_prompt: z.string().min(10).max(100000),
    model: z.string().default('google-gemma-3-27b-it'),
    temperature: z.number().min(0).max(1), // input as number, Prisma converts to Decimal
    max_tokens: z.number().min(50).max(2000).default(500),
    isActive: z.boolean().default(false),
})

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const prompts = await prisma.prompt.findMany({
        orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(prompts)
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const json = await req.json()
        const body = promptSchema.parse(json)

        if (body.isActive) {
            // If setting to active, deactivate all others first
            const [_, prompt] = await prisma.$transaction([
                prisma.prompt.updateMany({ data: { isActive: false } }),
                prisma.prompt.create({ data: body })
            ])
            return NextResponse.json(prompt, { status: 201 })
        } else {
            const prompt = await prisma.prompt.create({
                data: body
            })
            return NextResponse.json(prompt, { status: 201 })
        }
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
