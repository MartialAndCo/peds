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
        // Debug info (safe fallback)
        const msg = `Failed to connect to Waha: ${e.response?.data?.error || e.message}`

        console.error('[Session Reset] Error:', msg)
        return NextResponse.json({
            error: msg,
            details: e.response?.data
        }, { status: 500 })
    }
}
