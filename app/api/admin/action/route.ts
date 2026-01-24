import { NextResponse } from 'next/server'
import { whatsapp } from '@/lib/whatsapp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const body = await req.json()
        const result = await whatsapp.adminAction(body.action, body.agentId)
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('[Admin Proxy] Action error:', error.message)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
