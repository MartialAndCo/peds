import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/waha'

export async function POST(req: Request) {
    try {
        const { endpoint, session: sessionName, apiKey } = await getConfig()

        console.log(`[Session Stop] Stopping session '${sessionName}' at ${endpoint}`)

        const stopUrl = `${endpoint}/api/sessions/${sessionName}/stop`
        const res = await fetch(stopUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey
            },
            body: '{}'
        })

        if (res.ok) {
            return NextResponse.json({ success: true, message: 'Session stopped' })
        } else {
            const errorText = await res.text()
            console.error(`[Session Stop] Failed: ${errorText}`)
            return NextResponse.json({ error: `Failed to stop session: ${errorText}` }, { status: res.status })
        }

    } catch (error: any) {
        console.error('[Session Stop] Exception:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
