
import { NextResponse } from 'next/server'
import { whatsapp } from '@/lib/whatsapp'

export async function POST(req: Request) {
    try {
        const { sessionId } = await req.json()
        await whatsapp.deleteSession(sessionId || 'default')
        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
