import { NextResponse } from 'next/server'
import { whatsapp, getConfig } from '@/lib/whatsapp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { sessionId } = await req.json()
        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
        }

        // Debug Config
        const { endpoint } = await getConfig()
        console.log(`[Session Reset] Resetting session: ${sessionId} | Target: ${endpoint}`)

        const result = await whatsapp.resetSession(sessionId)

        return NextResponse.json(result)
    } catch (e: any) {
        const msg = e.response?.data?.error || e.message || 'Unknown error'
        console.error('[Session Reset] Error:', msg)
        return NextResponse.json({ error: msg, details: e.response?.data, debug_endpoint: 'See Server Logs' }, { status: 500 })
    }
}
