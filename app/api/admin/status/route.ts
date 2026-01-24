import { NextResponse } from 'next/server'
import { whatsapp } from '@/lib/whatsapp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const result = await whatsapp.adminStatus()
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('[Admin Proxy] Status error:', error.message)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
