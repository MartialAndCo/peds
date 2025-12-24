import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConfig } from '@/lib/waha'

export async function GET() {
    try {
        const { endpoint, session: sessionName, apiKey } = await getConfig()

        // Check if WAHA is up
        try {
            // We can use the list sessions endpoint to check our specific session
            const res = await fetch(`${endpoint}/api/sessions/${sessionName}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': apiKey
                }
            })

            if (!res.ok) {
                // Maybe session doesn't exist?
                return NextResponse.json({ status: 'STOPPED', error: 'Session not found or WAHA down' })
            }

            const data = await res.json()
            // data.status could be 'WORKING', 'SCAN_QR', 'STARTING', 'failed'
            return NextResponse.json({ ...data, _debug: 'modified_by_agent' })

        } catch (fetchError) {
            console.error('WAHA Status Check Error', fetchError)
            return NextResponse.json({ status: 'UNREACHABLE', error: 'Could not connect to WAHA' })
        }

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
