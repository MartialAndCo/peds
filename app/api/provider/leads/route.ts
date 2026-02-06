import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const leadSchema = z.object({
    type: z.enum(['WHATSAPP', 'DISCORD']),
    identifier: z.string().min(3), // Phone number or Discord username
    age: z.number().int().min(18).max(100).optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
    context: z.string().optional(),
    source: z.string().min(1),
})

// GET /api/provider/leads - Get provider's lead history
export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'PROVIDER') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status')
        const type = searchParams.get('type')
        const limit = parseInt(searchParams.get('limit') || '20')
        const page = parseInt(searchParams.get('page') || '1')
        const skip = (page - 1) * limit

        const where: any = { providerId: session.user.id }
        if (status) where.status = status
        if (type) where.type = type

        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip,
                include: {
                    agent: { select: { id: true, name: true, color: true } },
                    contact: { select: { id: true, status: true } }
                }
            }),
            prisma.lead.count({ where })
        ])

        return NextResponse.json({ leads, total, page, pages: Math.ceil(total / limit) })
    } catch (e: any) {
        console.error('Get Leads Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

// POST /api/provider/leads - Create a new lead
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'PROVIDER') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const json = await req.json()
        const body = leadSchema.parse(json)

        // Get provider config to find assigned agent
        const providerConfig = await prisma.providerConfig.findUnique({
            where: { providerId: session.user.id },
            include: { agent: true }
        })

        if (!providerConfig) {
            return NextResponse.json({ error: 'No agent assigned to your account' }, { status: 400 })
        }

        const agentId = providerConfig.agentId

        // Check for duplicate identifier
        const existingContact = await prisma.contact.findFirst({
            where: {
                OR: [
                    { phone_whatsapp: body.identifier },
                    { discordId: body.identifier }
                ]
            }
        })

        if (existingContact) {
            // Check if already a lead
            const existingLead = await prisma.lead.findFirst({
                where: { identifier: body.identifier }
            })
            
            if (existingLead) {
                return NextResponse.json({ 
                    error: 'DUPLICATE',
                    message: 'This lead already exists in the system',
                    leadId: existingLead.id,
                    status: existingLead.status
                }, { status: 409 })
            }
        }

        // Normalize phone number if WhatsApp
        let normalizedIdentifier = body.identifier
        if (body.type === 'WHATSAPP') {
            normalizedIdentifier = body.identifier.replace(/\s/g, '')
            if (/^0[67]/.test(normalizedIdentifier)) {
                normalizedIdentifier = '+33' + normalizedIdentifier.substring(1)
            }
        }

        // Create the lead
        const lead = await prisma.lead.create({
            data: {
                providerId: session.user.id,
                agentId,
                type: body.type,
                identifier: normalizedIdentifier,
                age: body.age,
                location: body.location,
                notes: body.notes,
                context: body.context,
                source: body.source,
                status: 'PENDING'
            }
        })

        // Create contact automatically
        const contactData: any = {
            name: body.type === 'DISCORD' ? body.identifier : undefined,
            source: `provider:${session.user.id}`,
            notes: body.notes || `Source: ${body.source}`,
            status: 'new',
            isHidden: false,
            profile: {
                age: body.age,
                location: body.location,
                providerContext: body.context,
                leadSource: body.source
            }
        }

        if (body.type === 'WHATSAPP') {
            contactData.phone_whatsapp = normalizedIdentifier
        } else {
            contactData.discordId = body.identifier
        }

        const contact = await prisma.contact.create({
            data: contactData
        })

        // Update lead with contact reference
        await prisma.lead.update({
            where: { id: lead.id },
            data: { 
                contactId: contact.id,
                status: 'IMPORTED'
            }
        })

        // Create AgentContact binding
        await prisma.agentContact.create({
            data: {
                agentId,
                contactId: contact.id,
                phase: 'CONNECTION'
            }
        })

        // Create initial conversation
        const agentPrompt = await prisma.agentPrompt.findFirst({
            where: { agentId, type: 'CORE' }
        })
        
        const prompt = agentPrompt 
            ? await prisma.prompt.findUnique({ where: { id: agentPrompt.promptId } })
            : await prisma.prompt.findFirst({ where: { isActive: true } })

        if (prompt) {
            await prisma.conversation.create({
                data: {
                    contactId: contact.id,
                    agentId,
                    promptId: prompt.id,
                    status: 'paused',
                    ai_enabled: true,
                    metadata: {
                        leadId: lead.id,
                        providerId: session.user.id,
                        leadContext: body.context,
                        leadSource: body.source
                    }
                }
            })
        }

        return NextResponse.json({ 
            success: true, 
            lead: { ...lead, contactId: contact.id, status: 'IMPORTED' },
            contact 
        }, { status: 201 })

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Create Lead Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
