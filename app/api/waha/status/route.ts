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
        // Extract agentId from query params if present
        const { searchParams } = new URL(req.url)
        const agentId = searchParams.get('agentId')

        const status = await whatsapp.getStatus(agentId ? agentId : undefined)

        console.log(`[WAHA Status] Agent ${agentId || 'global'}: ${JSON.stringify(status)}`)

        // Map Baileys status to what Frontend expects
        // Baileys returns: { status: 'CONNECTED' | 'SCAN_QR_CODE' | 'DISCONNECTED' | 'STARTING' | 'UNKNOWN', qr: '...' }
        // Frontend expects: { status: 'WORKING' | 'SCAN_QR_CODE' | 'STOPPED', me: { ... } }

        let mappedStatus = 'STOPPED'
        const rawStatus = status.status?.toUpperCase()

        if (rawStatus === 'CONNECTED' || rawStatus === 'ONLINE' || rawStatus === 'OPEN') {
            mappedStatus = 'WORKING'
        } else if (rawStatus === 'SCAN_QR_CODE' || rawStatus === 'SCAN_QR' || rawStatus === 'QR') {
            mappedStatus = 'SCAN_QR_CODE'
        } else if (rawStatus === 'STARTING') {
            mappedStatus = 'STARTING'
        }
        // DISCONNECTED, UNKNOWN, OFFLINE, etc. all map to STOPPED

        return NextResponse.json({
            status: mappedStatus,
            qr: status.qr,
            rawStatus: status.status, // Debug
            me: {
                id: 'baileys-user',
                pushName: 'Baileys User'
            }
        })
    } catch (e: any) {
        console.error('[WAHA Status] Error:', e.message)
        return NextResponse.json({ status: 'UNREACHABLE', error: e.message })
    }
}
