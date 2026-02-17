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
    agentId: z.string().optional(), // NEW: Bind to specific agent
})

// GET /api/contacts
export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status')
        const agentId = searchParams.get('agentId') // NEW: Filter by agent
        const limit = parseInt(searchParams.get('limit') || '50')
        const page = parseInt(searchParams.get('page') || '1')
        const skip = (page - 1) * limit

        const where: any = {
            source: { notIn: ['system', 'hidden'] }  // Hide system/hidden contacts by default
        }
        if (status) {
            where.status = status
        } else {
            // Default: Exclude blacklisted unless explicitly requested
            where.status = { not: 'blacklisted' }
        }

        // NEW: Filter by Agent Binding (AgentContact OR Conversation)
        if (agentId) {
            where.OR = [
                { agentContacts: { some: { agentId: agentId } } },
                { conversations: { some: { agentId: agentId } } }
            ]
        }
        
        // Allow admins to see system/hidden contacts if needed
        const showHidden = searchParams.get('showHidden') === 'true'
        if (showHidden && session.user.role === 'ADMIN') {
            delete where.source
        }

        const contacts = await prisma.contact.findMany({
            where,
            orderBy: { lastPhaseUpdate: 'desc' },
            take: limit,
            skip: skip,
            include: {
                conversations: {
                    where: { status: 'active' },
                    take: 1
                }
            }
        })

        return NextResponse.json(contacts)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
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
                    ...(body.agentId ? { agentId: body.agentId } : {}),
                    status: { in: ['active', 'paused'] }
                }
            })

            if (!existingConv) {
                // Determined prompt based on Agent ID if provided
                let promptId: number | undefined

                if (body.agentId) {
                    const agentPrompt = await prisma.agentPrompt.findFirst({
                        where: { agentId: (body.agentId as unknown as string), type: 'CORE' }
                    })
                    promptId = agentPrompt?.promptId
                }

                // Fallback to active global prompt
                if (!promptId) {
                    const prompt = await prisma.prompt.findFirst({ where: { isActive: true } }) || await prisma.prompt.findFirst()
                    promptId = prompt?.id
                }

                if (promptId) {
                    await prisma.conversation.create({
                        data: {
                            contactId: contact.id,
                            promptId: promptId,
                            agentId: (body.agentId as unknown as string), // Bind to agent if provided
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
                // Also update agent binding if it was null? (Optional, maybe safer to keep existing)
                await prisma.conversation.update({
                    where: { id: existingConv.id },
                    data: {
                        agentId: (body.agentId as unknown as string) || existingConv.agentId, // Update agent if provided
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
