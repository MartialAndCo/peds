import { NextResponse } from 'next/server'
import { whatsapp } from '@/lib/whatsapp'

export async function GET() {
    try {
        const result = await whatsapp.getStatus()

        // Map whatsapp-web.js status to WAHA-like status for frontend compatibility
        // WAHA: 'WORKING', 'SCAN_QR_CODE', 'STOPPED', 'STARTING'
        // My Service: 'INITIALIZING', 'SCAN_QR_CODE', 'CONNECTED', 'AUTHENTICATED', 'DISCONNECTED'

        let status = result.status || 'STOPPED'
        let qr = result.qr

        if (status === 'CONNECTED' || status === 'AUTHENTICATED') {
            status = 'WORKING'
        } else if (status === 'SCAN_QR_CODE') {
            status = 'SCAN_QR'
        }

        // Return structure: { status, me: { ... } } (for now me is missing but okay)
        return NextResponse.json({
            status,
            me: { id: 'unknown', pushName: 'WhatsApp User' }, // TODO: Fetch 'me' from service
            qrRaw: qr
        })

    } catch (error: any) {
        console.error('[API Status] Error fetching status:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
