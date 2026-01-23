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
    context: z.string().optional(), // NEW: for Lead Provider simulation
    status: z.enum(['new', 'contacted', 'qualified', 'closed', 'active', 'archive', 'blacklisted', 'merged']).optional().default('new'),
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
    if (agentId && !isNaN(parseInt(agentId))) {
        where.conversations = {
            some: {
                OR: [
                    { agentId: parseInt(agentId) },
                    { agentId: null }
                ]
            }
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
        let normalizedPhone = body.phone_whatsapp.replace(/\s/g, '')

        // Ensure +33 default if it starts with 06/07 and has no country code
        if (/^0[67]/.test(normalizedPhone)) {
            normalizedPhone = '+33' + normalizedPhone.substring(1)
        }

        // 1. Upsert Contact logic
        let contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: normalizedPhone }
        })

        if (!contact) {
            contact = await prisma.contact.create({
                data: {
                    phone_whatsapp: normalizedPhone,
                    name: body.name,
                    source: body.source || (body.context ? 'lead_provider_manual' : 'manual'),
                    notes: body.notes || (body.context ? `Context: ${body.context}` : undefined),
                    status: body.status || 'new'
                }
            })
        } else {
            // Update existing contact
            const newNotes = body.context
                ? (contact.notes ? contact.notes + `\n\n[Lead Update]: ${body.context}` : `Context: ${body.context}`)
                : (body.notes || contact.notes)

            contact = await prisma.contact.update({
                where: { id: contact.id },
                data: {
                    name: body.name || contact.name,
                    notes: newNotes,
                    source: body.source || contact.source
                }
            })
        }

        // 2. Lead Initialization (if context provided)
        if (body.context) {
            const existingConv = await prisma.conversation.findFirst({
                where: {
                    contactId: contact.id,
                    status: { in: ['active', 'paused'] }
                }
            })

            if (!existingConv) {
                const prompt = await prisma.prompt.findFirst({ where: { isActive: true } }) || await prisma.prompt.findFirst()
                if (prompt) {
                    await prisma.conversation.create({
                        data: {
                            contactId: contact.id,
                            promptId: prompt.id,
                            status: 'paused',
                            ai_enabled: true,
                            metadata: {
                                state: 'WAITING_FOR_LEAD',
                                leadContext: body.context
                            }
                        }
                    })
                }
            } else if (existingConv.status === 'paused') {
                // If paused, we can inject/update the waiting state
                await prisma.conversation.update({
                    where: { id: existingConv.id },
                    data: {
                        metadata: {
                            ...(existingConv.metadata as any || {}),
                            state: 'WAITING_FOR_LEAD',
                            leadContext: body.context
                        }
                    }
                })
            }
        }

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
