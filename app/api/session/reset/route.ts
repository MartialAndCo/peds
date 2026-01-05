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
        const { sessionId } = await req.json()
        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
        }

        console.log(`[Session Reset] Resetting session: ${sessionId}`)

        const result = await whatsapp.resetSession(sessionId)

        return NextResponse.json(result)
    } catch (e: any) {
        console.error('[Session Reset] Error:', e.message)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
