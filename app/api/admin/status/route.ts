import { NextResponse } from 'next/server'
import { whatsapp } from '@/lib/whatsapp'

// Proxy to Baileys admin status endpoint
export async function GET(req: Request) {
    try {
        const result = await whatsapp.adminStatus()
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('[Admin Proxy] Status error:', error.message)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
