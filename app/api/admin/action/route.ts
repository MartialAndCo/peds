import { NextResponse } from 'next/server'
import { whatsapp } from '@/lib/whatsapp'

// Proxy to Baileys admin action endpoint
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const result = await whatsapp.adminAction(body.action)
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('[Admin Proxy] Action error:', error.message)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
