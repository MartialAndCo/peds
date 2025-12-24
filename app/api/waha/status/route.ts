import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { waha } from '@/lib/waha'

export async function GET() {
    try {
        // Fetch settings from DB to get WAHA endpoint
        // Note: lib/waha.ts currently reads process.env.
        // We really should update lib/waha.ts to support dynamic config too,
        // similar to how we updated venice.ts.
        // For now, let's assume if env is not set, we use DB?
        // Actually, let's fetch DB settings here and pass to a modified waha lib,
        // or just use axios directly here for the status check to avoid circular deps or complex refactors right now.

        const settingsList = await prisma.setting.findMany()
        const settings = settingsList.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        let endpoint = settings.waha_endpoint || process.env.WAHA_ENDPOINT || 'http://localhost:3001'
        const sessionName = settings.waha_session || process.env.WAHA_SESSION || 'default'

        // Check if WAHA is up
        try {
            // We can use the list sessions endpoint to check our specific session
            const res = await fetch(`${endpoint}/api/sessions/${sessionName}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': settings.waha_api_key || process.env.WAHA_API_KEY || 'secret'
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
