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
    overwrite: z.boolean().optional().default(false),
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

        // Normalize identifier
        let normalizedIdentifier = body.identifier
        if (body.type === 'WHATSAPP') {
            normalizedIdentifier = body.identifier.replace(/\s/g, '')
            if (/^0[67]/.test(normalizedIdentifier)) {
                normalizedIdentifier = '+33' + normalizedIdentifier.substring(1)
            }
        } else {
            // Discord: remove spaces and lowercase for consistency
            normalizedIdentifier = body.identifier.replace(/\s/g, '').toLowerCase()
        }

        // Check for duplicate identifier
        const existingContact = await prisma.contact.findFirst({
            where: {
                OR: [
                    { phone_whatsapp: normalizedIdentifier },
                    { discordId: normalizedIdentifier }
                ]
            }
        })

        let existingLead = null
        if (existingContact) {
            // Check if already a lead
            existingLead = await prisma.lead.findFirst({
                where: { identifier: normalizedIdentifier },
                include: { agent: { select: { name: true } } }
            })
            
            if (existingLead) {
                if (!body.overwrite) {
                    return NextResponse.json({ 
                        error: 'DUPLICATE',
                        message: 'This lead already exists in the system',
                        leadId: existingLead.id,
                        status: existingLead.status,
                        agent: existingLead.agent?.name
                    }, { status: 409 })
                }
                
                // Overwrite: delete existing lead and contact using centralized function
                console.log(`[Lead Overwrite] Deleting lead ${existingLead.id} and contact ${existingContact.id}`)
                
                const { deleteContactCompletely } = await import('@/lib/contact-utils')
                
                // 1. Détacher le contact du lead (mettre contactId à null)
                // Sinon on ne peut pas supprimer le lead à cause de la contrainte FK
                await prisma.lead.update({
                    where: { id: existingLead.id },
                    data: { contactId: null }
                })
                
                // 2. Supprimer le lead (plus de référence vers contact)
                await prisma.lead.delete({
                    where: { id: existingLead.id }
                })
                
                // 3. Supprimer le contact et toutes ses données
                await deleteContactCompletely(existingContact.id)
                
                console.log(`[Lead Overwrite] Successfully deleted old lead and contact`)
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
                    context: body.context,
                source: body.source,
                status: 'PENDING'
            }
        })

        // Create contact automatically
        const contactData: any = {
            source: `provider:${session.user.id}`,
            notes: `Source: ${body.source}`,
            status: 'new',  // Start as new, will become active on first response (coherent with WhatsApp leads)
            isHidden: false,  // Contact is visible, conversation will be filtered
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
            // For Discord: store username in name (normalized), discordId will be filled when user messages
            contactData.name = normalizedIdentifier
            // discordId stays null until the bot receives a message from this user
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
                        state: 'WAITING_FOR_LEAD',  // ✅ CRITICAL: Flag to wake up conversation on first message
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
