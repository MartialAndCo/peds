import { NextResponse } from 'next/server'
import { whatsapp } from '@/lib/whatsapp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const status = await whatsapp.getStatus()

        // Map Baileys status to what Frontend expects
        // Baileys returns: { status: 'CONNECTED' | 'SCAN_QR_CODE' | 'DISCONNECTED', qr: '...' }
        // Frontend expects: { status: 'WORKING' | 'SCAN_QR_CODE' | 'STOPPED', me: { ... } }

        let mappedStatus = 'UNKNOWN'
        if (status.status === 'CONNECTED') mappedStatus = 'WORKING'
        else if (status.status === 'SCAN_QR_CODE') mappedStatus = 'SCAN_QR_CODE'
        else if (status.status === 'DISCONNECTED' || status.status === 'STARTING') mappedStatus = 'STOPPED' // or STARTING

        return NextResponse.json({
            status: mappedStatus,
            qr: status.qr,
            me: {
                id: 'baileys-user',
                pushName: 'Baileys User'
            } // Baileys doesn't return detailed "Me" info in status yet, mocking for UI safety
        })
    } catch (e: any) {
        return NextResponse.json({ status: 'UNREACHABLE', error: e.message })
    }
}
