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

        console.log(`[Session] Starting session for agent: ${agentId}`)
        const result = await whatsapp.startSession(agentId)

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Session started' })
    } catch (e: any) {
        // Debug info
        const { endpoint } = await import('@/lib/whatsapp').then(m => m.getConfig())
        const msg = `Failed to connect to Waha at [${endpoint}]: ${e.response?.data?.error || e.message}`

        console.error('[Session] Start Error:', msg)
        return NextResponse.json({ error: msg, details: e.response?.data }, { status: 500 })
    }
}
