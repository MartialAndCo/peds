import { NextResponse } from 'next/server'
import { whatsapp } from '@/lib/whatsapp'
import QRCode from 'qrcode'

export async function GET() {
    try {
        const result = await whatsapp.getStatus()

        if (result && result.qr) {
            // Generate QR Image Buffer
            const qrBuffer = await QRCode.toBuffer(result.qr)

            return new NextResponse(qrBuffer as any, {
                headers: {
                    'Content-Type': 'image/png',
                    'Content-Length': qrBuffer.length.toString()
                }
            })
        }

        return new NextResponse('No QR Code available', { status: 404 })

    } catch (error: any) {
        console.error('QR Gen Error', error)
        return new NextResponse('Error generating QR', { status: 500 })
    }
}
