import { NextResponse } from 'next/server'
import { whatsapp } from '@/lib/whatsapp'
import QRCode from 'qrcode'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Extract agentId from query params
        const { searchParams } = new URL(req.url)
        const agentId = searchParams.get('agentId')

        const status = await whatsapp.getStatus(agentId ? parseInt(agentId) : undefined)
        const qr = status.qr

        if (!qr) {
            return new NextResponse('No QR Code available (Connected?)', { status: 404 })
        }

        const qrBuffer = await QRCode.toBuffer(qr)

        return new NextResponse(qrBuffer as any, {
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': qrBuffer.length.toString()
            }
        })
    } catch (e: any) {
        console.error('QR Gen Error:', e)
        return new NextResponse(e.message, { status: 500 })
    }
}
