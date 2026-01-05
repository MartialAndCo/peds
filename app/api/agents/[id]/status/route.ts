import { NextResponse } from 'next/server'
import { whatsapp } from '@/lib/whatsapp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    try {
        const status = await whatsapp.getStatus(parseInt(id))
        return NextResponse.json(status)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    try {
        const res = await whatsapp.startSession(id)
        return NextResponse.json(res)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

// DELETE = Logout / Stop Session
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    try {
        const res = await whatsapp.stopSession(id)
        return NextResponse.json(res)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
