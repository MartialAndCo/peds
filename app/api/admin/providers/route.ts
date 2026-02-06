import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const providerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    agentId: z.string(),
})

// GET /api/admin/providers - List all providers
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const providers = await prisma.user.findMany({
            where: { role: 'PROVIDER' },
            include: {
                providerConfig: {
                    include: {
                        agent: { select: { id: true, name: true, color: true } }
                    }
                },
                _count: {
                    select: { leads: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        // Calculate total cost per provider ($4 per lead)
        const providersWithStats = providers.map(p => ({
            id: p.id,
            email: p.email,
            createdAt: p.createdAt,
            agent: p.providerConfig?.agent || null,
            stats: {
                totalLeads: p._count.leads,
                totalCost: p._count.leads * 4
            }
        }))

        return NextResponse.json(providersWithStats)
    } catch (e: any) {
        console.error('Get Providers Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

// POST /api/admin/providers - Create new provider
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const json = await req.json()
        const body = providerSchema.parse(json)

        // Check if agent exists
        const agent = await prisma.agent.findUnique({
            where: { id: body.agentId }
        })

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 400 })
        }

        const hashedPassword = await bcrypt.hash(body.password, 10)

        // Create user and provider config in transaction
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: body.email,
                    password: hashedPassword,
                    role: 'PROVIDER'
                }
            })

            await tx.providerConfig.create({
                data: {
                    providerId: user.id,
                    agentId: body.agentId
                }
            })

            return user
        })

        return NextResponse.json({ 
            success: true, 
            provider: { 
                id: result.id, 
                email: result.email,
                agentId: body.agentId
            } 
        }, { status: 201 })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
        }
        console.error('Create Provider Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PUT /api/admin/providers - Update provider (agent assignment)
export async function PUT(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { id, agentId, password } = body

        if (!id) {
            return NextResponse.json({ error: 'Missing provider ID' }, { status: 400 })
        }

        const updateData: any = {}

        if (password) {
            updateData.password = await bcrypt.hash(password, 10)
        }

        // Update user
        if (Object.keys(updateData).length > 0) {
            await prisma.user.update({
                where: { id },
                data: updateData
            })
        }

        // Update agent assignment
        if (agentId) {
            await prisma.providerConfig.upsert({
                where: { providerId: id },
                update: { agentId },
                create: {
                    providerId: id,
                    agentId
                }
            })
        }

        return NextResponse.json({ success: true })
    } catch (e: any) {
        console.error('Update Provider Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

// DELETE /api/admin/providers?id=xxx
export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

        // Delete provider config first (foreign key)
        await prisma.providerConfig.deleteMany({
            where: { providerId: id }
        })

        // Delete user
        await prisma.user.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (e: any) {
        console.error('Delete Provider Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
