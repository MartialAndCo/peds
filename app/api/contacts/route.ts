import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const contactSchema = z.object({
    name: z.string().min(1),
    phone_whatsapp: z.string().min(8).regex(/^\+?[0-9\s]+$/, 'Invalid phone number'),
    source: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(['new', 'contacted', 'qualified', 'closed']).default('new'),
})

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const search = searchParams.get('search')
    const agentId = searchParams.get('agentId')

    const where: any = {}
    if (status) where.status = status
    if (source) where.source = source
    if (search) {
        where.OR = [
            { name: { contains: search } }, // sqlite is distinct from postgres (ilike vs contains fallback)
            { phone_whatsapp: { contains: search } }
        ]
    }

    // Filter by Agent if provided
    if (agentId) {
        where.conversations = {
            some: { agentId: parseInt(agentId) }
        }
    }

    // Filter out hidden contacts unless explicitly requested? No, user wants them gone.
    where.isHidden = false;

    const contacts = await prisma.contact.findMany({
        where,
        orderBy: { updatedAt: 'desc' }, // Sort by recently active, not created
        take: 100 // limit to 100 for safety
    })
    return NextResponse.json(contacts)
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const json = await req.json()
        const body = contactSchema.parse(json)

        // Normalize phone (remove spaces)
        const normalizedPhone = body.phone_whatsapp.replace(/\s/g, '')

        const contact = await prisma.contact.create({
            data: {
                ...body,
                phone_whatsapp: normalizedPhone
            }
        })

        return NextResponse.json(contact, { status: 201 })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Phone number already exists' }, { status: 409 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
