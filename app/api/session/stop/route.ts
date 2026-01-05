import { NextResponse } from 'next/server'
import { whatsapp } from '@/lib/whatsapp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json().catch(() => ({}))
        const agentId = body.agentId || 'default'

        console.log(`[Session] Stopping session for agent: ${agentId}`)
        const result = await whatsapp.stopSession(agentId)

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Session stopped' })
    } catch (e: any) {
        console.error('[Session] Stop Error:', e.message)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
