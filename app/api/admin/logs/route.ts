import { NextResponse } from 'next/server'
import { whatsapp } from '@/lib/whatsapp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const lines = Number(searchParams.get('lines')) || 100

    try {
        const result = await whatsapp.adminLogs(lines)
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('[Admin Proxy] Logs error:', error.message)
        return NextResponse.json({ success: false, error: error.message, lines: [] }, { status: 500 })
    }
}
