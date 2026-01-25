import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const users = await prisma.user.findMany({
        include: {
            agents: { select: { id: true, name: true, color: true } }
        },
        orderBy: { createdAt: 'desc' }
    })

    // Mask passwords
    const safeUsers = users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        agents: u.agents
    }))

    return NextResponse.json(safeUsers)
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const body = await req.json()
        const { email, password, role, agentIds } = body

        if (!email || !password) {
            return NextResponse.json({ error: 'Missing Required Fields' }, { status: 400 })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                role: role || 'COLLABORATOR',
                agents: agentIds && agentIds.length > 0 ? {
                    connect: agentIds.map((id: string) => ({ id: String(id) }))
                } : undefined
            }
        })

        return NextResponse.json({ success: true, user: { id: user.id, email: user.email } })
    } catch (e: any) {
        if (e.code === 'P2002') {
            return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
        }
        console.error('Create User Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}


// Update User
export async function PUT(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const body = await req.json()
        const { id, email, password, role, agentIds } = body

        if (!id || !email) {
            return NextResponse.json({ error: 'Missing Required Fields' }, { status: 400 })
        }

        const updateData: any = {
            email,
            role,
            agents: {
                // Agent IDs are Strings (CUID), not Integers.
                set: agentIds && agentIds.length > 0 ? agentIds.map((aid: string) => ({ id: aid })) : []
            }
        }

        if (password) {
            updateData.password = await bcrypt.hash(password, 10)
        }

        const user = await prisma.user.update({
            where: { id },
            data: updateData
        })

        return NextResponse.json({ success: true, user: { id: user.id, email: user.email } })
    } catch (e: any) {
        if (e.code === 'P2002') {
            return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
        }
        console.error('Update User Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}


export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

        // Prevent self-deletion
        if (session.user.id === id) {
            return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
        }

        await prisma.user.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
